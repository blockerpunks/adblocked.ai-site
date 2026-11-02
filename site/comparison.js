// Local before/after image comparison. No requests or persistent state.
(function () {
  'use strict';

  document.querySelectorAll('[data-comparison]').forEach(function (comparison) {
    var stage = comparison.querySelector('.comparison-stage');
    var range = comparison.querySelector('.comparison-range');
    var handle = comparison.querySelector('.comparison-handle');
    var controls = comparison.querySelector('.comparison-controls');
    var activePointer = null;

    function update(value) {
      var position = Number(value);
      if (!Number.isFinite(position)) position = 50;
      position = Math.round(Math.max(0, Math.min(100, position)) * 10) / 10;
      range.value = String(position);
      stage.style.setProperty('--position', position + '%');
      var description = position === 0 ? 'After: sponsored content removed' :
        position === 100 ? 'Before: sponsored content visible' :
        position + '% before, ' + (Math.round((100 - position) * 10) / 10) + '% after';
      range.setAttribute('aria-valuetext', description);
    }

    function updateFromPointer(event) {
      var bounds = stage.getBoundingClientRect();
      if (bounds.width > 0) update((event.clientX - bounds.left) / bounds.width * 100);
    }

    range.hidden = false;
    handle.hidden = false;
    controls.hidden = false;
    stage.classList.add('comparison-ready');
    update(range.value);

    // Keep the browser's native keyboard and assistive-technology range behavior.
    range.addEventListener('input', function () { update(range.value); });
    range.addEventListener('change', function () { update(range.value); });

    stage.addEventListener('pointerdown', function (event) {
      if (!event.isPrimary || event.button !== 0) return;
      activePointer = event.pointerId;
      stage.setPointerCapture(activePointer);
      range.focus({ preventScroll: true });
      updateFromPointer(event);
      if (event.pointerType === 'mouse') event.preventDefault();
    });

    stage.addEventListener('pointermove', function (event) {
      if (event.pointerId === activePointer) updateFromPointer(event);
    });

    function finishPointer(event) {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    }

    stage.addEventListener('pointerup', finishPointer);
    stage.addEventListener('pointercancel', finishPointer);
    stage.addEventListener('lostpointercapture', function () { activePointer = null; });

    comparison.querySelectorAll('[data-comparison-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        update(button.dataset.comparisonView === 'before' ? 100 : 0);
      });
    });
  });
}());
