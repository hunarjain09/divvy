/**
 * Tests the real SwipeRow component from divvy.html (extracted and compiled
 * at test time), so the tests can't drift from the shipped code.
 */
import fs from 'fs';
import path from 'path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { transformSync } from '@babel/core';
import { jest } from '@jest/globals';

global.IS_REACT_ACT_ENVIRONMENT = true;

function loadSwipeRow() {
  const html = fs.readFileSync(path.join(__dirname, '../../divvy.html'), 'utf8');
  const start = html.indexOf('const SwipeRow = (');
  const end = html.indexOf('const BenefitItem');
  if (start === -1 || end === -1) throw new Error('SwipeRow not found in divvy.html');
  const source = html.slice(start, end);
  const { code } = transformSync(
    `function factory(React) {
       const { useState, useRef, useEffect } = React;
       const Icon = ({ name }) => <span data-icon={name} />;
       ${source}
       return SwipeRow;
     }`,
    { presets: [['@babel/preset-react', { runtime: 'classic' }]], configFile: false }
  );
  return new Function(`${code}; return factory;`)()(React);
}

const SwipeRow = loadSwipeRow();

const touch = (el, type, x, y = 0) => {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: x, clientY: y };
  ev.touches = type === 'touchend' ? [] : [point];
  ev.changedTouches = [point];
  act(() => { el.dispatchEvent(ev); });
};

const swipe = (el, fromX, toX, dy = 0) => {
  touch(el, 'touchstart', fromX, 0);
  touch(el, 'touchmove', (fromX + toX) / 2, dy / 2);
  touch(el, 'touchmove', toX, dy);
  touch(el, 'touchend', toX, dy);
};

describe('SwipeRow', () => {
  let container, root, onLeft, onRight, onHintDone;

  const render = (props = {}) => {
    act(() => {
      root.render(
        <SwipeRow onSwipeLeft={onLeft} onSwipeRight={onRight} onHintDone={onHintDone} {...props}>
          <div data-testid="content">row</div>
        </SwipeRow>
      );
    });
    return container.querySelector('[data-testid="content"]').parentElement;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onLeft = jest.fn();
    onRight = jest.fn();
    onHintDone = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  test('swipe left past threshold triggers edit only', () => {
    const el = render();
    swipe(el, 300, 150);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).not.toHaveBeenCalled();
  });

  test('swipe right past threshold triggers delete only', () => {
    const el = render();
    swipe(el, 100, 250);
    expect(onRight).toHaveBeenCalledTimes(1);
    expect(onLeft).not.toHaveBeenCalled();
  });

  test('short swipe does nothing and snaps back', () => {
    const el = render();
    swipe(el, 200, 150);
    swipe(el, 200, 250);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
    expect(el.style.transform).toBe('translateX(0px)');
  });

  test('mostly-vertical gesture is treated as scroll', () => {
    const el = render();
    swipe(el, 200, 100, 120);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  test('row follows the finger and is clamped at 120px', () => {
    const el = render();
    touch(el, 'touchstart', 300, 0);
    touch(el, 'touchmove', 250, 0);
    expect(el.style.transform).toBe('translateX(-50px)');
    touch(el, 'touchmove', 0, 0);
    expect(el.style.transform).toBe('translateX(-120px)');
  });

  test('shows edit panel when swiping left and delete panel when swiping right', () => {
    const el = render();
    touch(el, 'touchstart', 200, 0);
    touch(el, 'touchmove', 150, 0);
    expect(container.querySelector('[data-icon="edit"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="delete"]')).toBeNull();
    touch(el, 'touchmove', 250, 0);
    expect(container.querySelector('[data-icon="delete"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="edit"]')).toBeNull();
  });

  describe('first-run hint', () => {
    test('is not shown by default', () => {
      render();
      expect(container.textContent).not.toMatch(/Swipe left to edit/);
    });

    test('shows the label, demos both directions, then reports done', () => {
      const el = render({ hint: true });
      expect(container.textContent).toMatch(/Swipe left to edit/);

      act(() => jest.advanceTimersByTime(700));
      expect(el.style.transform).toBe('translateX(-70px)');
      act(() => jest.advanceTimersByTime(700));
      expect(el.style.transform).toBe('translateX(70px)');
      act(() => jest.advanceTimersByTime(700));
      expect(el.style.transform).toBe('translateX(0px)');

      act(() => jest.advanceTimersByTime(700));
      expect(onHintDone).toHaveBeenCalledTimes(1);
      // the demo itself never fires the real actions
      expect(onLeft).not.toHaveBeenCalled();
      expect(onRight).not.toHaveBeenCalled();
    });

    test('touching the row stops the demo and marks it seen', () => {
      const el = render({ hint: true });
      touch(el, 'touchstart', 200, 0);
      expect(onHintDone).toHaveBeenCalledTimes(1);
      act(() => jest.advanceTimersByTime(5000));
      expect(onHintDone).toHaveBeenCalledTimes(1);
    });
  });
});
