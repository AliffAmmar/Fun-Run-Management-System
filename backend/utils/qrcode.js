const QRCode = require('qrcode');
const crypto = require('crypto');

const generateTicketCode = () => {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
};

const generateQRCode = async (data) => {
  try {
    const qrCode = await QRCode.toDataURL(data);
    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

module.exports = { generateTicketCode, generateQRCode };
