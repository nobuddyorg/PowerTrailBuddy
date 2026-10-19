// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  badgeElement,
  foundElement,
  parkingElement,
  positionElement,
  targetPulseElement,
  textElement,
} from './elements';

describe('map elements', () => {
  it('writes a rank badge in the trail colour, faded when not emphasised', () => {
    const badge = badgeElement({
      rank: 3,
      color: 'rgb(1, 2, 3)',
      emphasised: true,
    });
    expect(badge.textContent).toBe('3');
    expect(badge.className).toBe('ptb-badge');
    expect(badge.style.background).toBe('rgb(1, 2, 3)');
    expect(badge.style.opacity).toBe('1');
    expect(
      badgeElement({ rank: 1, color: 'red', emphasised: false }).style.opacity,
    ).toBe('0.55');
  });

  it('marks parking, a find and the target', () => {
    expect(parkingElement().textContent).toBe('P');
    expect(parkingElement().className).toBe('ptb-parking');
    expect(foundElement().textContent).toBe('✓');
    expect(foundElement().className).toBe('ptb-found');
    expect(targetPulseElement().className).toBe('ptb-target-pulse');
  });

  it('turns the position cone to the heading, and leaves it out without one', () => {
    const facing = positionElement(90);
    const cone = facing.querySelector<HTMLElement>('.ptb-position__cone')!;
    expect(cone.style.transform).toBe('rotate(90deg)');
    expect(facing.querySelector('.ptb-position__dot')).not.toBeNull();
    expect(positionElement().querySelector('.ptb-position__cone')).toBeNull();
    expect(positionElement().className).toBe('ptb-position');
  });

  it('sets imported text as text, never as markup', () => {
    const node = textElement('<img src=x onerror=alert(1)>');
    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(node.querySelector('img')).toBeNull();
  });
});
