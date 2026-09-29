/**
 * A thin draggable divider between two resizable panes.
 * `orientation="vertical"` = a vertical bar you drag left/right (splits width).
 * `orientation="horizontal"` = a horizontal bar you drag up/down (splits height).
 * All the actual drag math lives in useResizableSplit — this is just the
 * hit target + visual affordance, spreading whatever handlers it's given.
 */
const ResizeHandle = ({ orientation, isDragging, ...handleProps }) => (
  <div
    className={
      'resize-handle ' +
      (orientation === 'vertical' ? 'resize-handle-vertical' : 'resize-handle-horizontal') +
      (isDragging ? ' dragging' : '')
    }
    aria-label={orientation === 'vertical' ? 'Resize editor and preview' : 'Resize editor and console'}
    {...handleProps}
  >
    <span className="resize-handle-grip" aria-hidden="true" />
  </div>
);

export default ResizeHandle;
