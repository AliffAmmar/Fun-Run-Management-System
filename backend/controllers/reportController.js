const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Event = require('../models/Event');
const Report = require('../models/Report');
const { getEventReportMetrics } = require('../utils/reportMetrics');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getAuthorizedEvent = async (req, res) => {
  const { eventId } = req.params;
  if (!isValidObjectId(eventId)) {
    res.status(400).json({ message: 'Invalid event ID' });
    return null;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
    res.status(403).json({ message: 'Not authorized to access this event report' });
    return null;
  }
  return event;
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildExportRows = (event, metrics) => {
  const rows = [
    ['Run4Fun Event Report', event.event_name],
    ['Event ID', event._id],
    ['Total registrations', metrics.registration_count],
    ['Total participants', metrics.total_participants],
    ['Total revenue', metrics.total_revenue.toFixed(2)],
    ['Capacity utilization', metrics.capacity_utilization],
    ['Checked-in participants', metrics.checked_in_participants],
    ['Attendance rate', metrics.attendance_rate],
    ['Pending payments', metrics.payment_counts.pending],
    ['Failed payments', metrics.payment_counts.failed],
    ['Refunded payments', metrics.payment_counts.refunded],
    [],
    ['Race category', 'Participants', 'Revenue'],
  ];

  for (const [category, values] of Object.entries(metrics.breakdowns.by_race_category)) {
    rows.push([category, values.participants, values.revenue.toFixed(2)]);
  }
  rows.push([], ['Registration type', 'Registrations', 'Participants', 'Revenue']);
  for (const [type, values] of Object.entries(metrics.breakdowns.by_registration_type)) {
    rows.push([type, values.registrations, values.participants, values.revenue.toFixed(2)]);
  }
  rows.push([], ['Payment method', 'Payments', 'Successful amount']);
  for (const [method, values] of Object.entries(metrics.breakdowns.by_payment_method)) {
    rows.push([method, values.payments, values.amount.toFixed(2)]);
  }
  rows.push([], ['Shirt size', 'Participants']);
  for (const [size, count] of Object.entries(metrics.breakdowns.by_shirt_size)) {
    rows.push([size, count]);
  }
  rows.push([], ['Registration date', 'Registrations']);
  for (const item of metrics.breakdowns.registrations_per_day) {
    rows.push([item.date, item.count]);
  }
  return rows;
};

const getOverview = async (req, res) => {
  try {
    if (!['organizer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Organizer or admin access required' });
    }

    const filter = req.user.role === 'admin' ? {} : { organizer_id: req.user.userId };
    const events = await Event.find(filter).sort({ date: -1 }).lean();
    const reports = await Promise.all(events.map(async (event) => ({
      ...event,
      ...(await getEventReportMetrics(event._id, event)),
    })));
    return res.json({ events: reports });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get report overview', error: error.message });
  }
};

const getEventSummary = async (req, res) => {
  try {
    const event = await getAuthorizedEvent(req, res);
    if (!event) return;
    const metrics = await getEventReportMetrics(event._id, event);
    return res.json({ event, metrics });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate event report', error: error.message });
  }
};

const getEventHistory = async (req, res) => {
  try {
    const event = await getAuthorizedEvent(req, res);
    if (!event) return;
    const reports = await Report.find({ event_id: event._id })
      .populate('generated_by', 'name email')
      .sort({ createdAt: -1 });
    return res.json({ reports });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get report history', error: error.message });
  }
};

const exportEventReport = async (req, res) => {
  try {
    const event = await getAuthorizedEvent(req, res);
    if (!event) return;

    const format = req.body.format;
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ message: "Format must be 'csv' or 'pdf'" });
    }

    const metrics = await getEventReportMetrics(event._id, event);
    const filename = `event-report-${event._id}-${Date.now()}.${format}`;
    await Report.create({
      event_id: event._id,
      generated_by: req.user.userId,
      total_participants: metrics.total_participants,
      total_revenue: metrics.total_revenue,
      data: metrics,
      export_format: format,
      export_file: filename,
    });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(buildExportRows(event, metrics).map((row) => row.map(csvCell).join(',')).join('\r\n'));
    }

    res.setHeader('Content-Type', 'application/pdf');
    const document = new PDFDocument({ margin: 48 });
    document.on('error', (error) => {
      if (res.headersSent) res.destroy(error);
      else res.status(500).json({ message: 'Failed to stream report', error: error.message });
    });
    document.pipe(res);
    document.fontSize(20).text('Run4Fun Event Report');
    document.moveDown(0.5).fontSize(15).text(event.event_name);
    document.moveDown().fontSize(11);
    document.text(`Total registrations: ${metrics.registration_count}`);
    document.text(`Total participants: ${metrics.total_participants}`);
    document.text(`Total revenue: ${metrics.total_revenue.toFixed(2)}`);
    document.text(`Capacity utilization: ${(metrics.capacity_utilization * 100).toFixed(1)}%`);
    document.text(`Checked-in participants: ${metrics.checked_in_participants}`);
    document.text(`Attendance rate: ${(metrics.attendance_rate * 100).toFixed(1)}%`);
    document.text(`Payments pending / failed / refunded: ${metrics.payment_counts.pending} / ${metrics.payment_counts.failed} / ${metrics.payment_counts.refunded}`);

    const writeSection = (title, entries, render) => {
      document.moveDown().fontSize(14).text(title);
      document.moveDown(0.25).fontSize(10);
      if (entries.length === 0) document.text('No data');
      entries.forEach(([key, value]) => document.text(render(key, value)));
    };
    writeSection('Race categories', Object.entries(metrics.breakdowns.by_race_category), (key, value) =>
      `${key}: ${value.participants} participants, ${value.revenue.toFixed(2)} revenue`);
    writeSection('Registration types', Object.entries(metrics.breakdowns.by_registration_type), (key, value) =>
      `${key}: ${value.registrations} registrations, ${value.participants} participants`);
    writeSection('Payment methods', Object.entries(metrics.breakdowns.by_payment_method), (key, value) =>
      `${key}: ${value.payments} payments, ${value.amount.toFixed(2)} successful amount`);
    writeSection('Shirt sizes', Object.entries(metrics.breakdowns.by_shirt_size), (key, value) => `${key}: ${value}`);
    writeSection('Registrations per day', metrics.breakdowns.registrations_per_day.map((item) => [item.date, item.count]),
      (key, value) => `${key}: ${value}`);
    document.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Failed to export event report', error: error.message });
    }
    return res.destroy(error);
  }
};

module.exports = { getOverview, getEventSummary, exportEventReport, getEventHistory };