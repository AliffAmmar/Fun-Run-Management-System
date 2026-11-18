import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ImageGallery from './ImageGallery';
import { imageSrc } from '../../utils/eventImages';

test('picture addresses are built from the API base', () => {
  expect(imageSrc('/events/e1/images/i1')).toBe('/api/events/e1/images/i1');
  expect(imageSrc(null)).toBeNull();
});

test('gallery shows captions and opens the full-screen viewer on tap', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const images = [
    { _id: 'a', caption: 'Shirt size chart', url: '/events/e/images/a' },
    { _id: 'b', caption: 'Race kit', url: '/events/e/images/b' },
  ];
  act(() => root.render(<ImageGallery images={images} />));
  expect(container.textContent).toMatch('Shirt size chart');
  expect(container.querySelectorAll('img')).toHaveLength(2);

  act(() => container.querySelector('button').click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.textContent).toMatch('1 / 2');

  act(() => root.unmount());
  container.remove();
});
