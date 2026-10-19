// DOM for Leaflet's divIcons, built node by node: text from an imported file must never be parsed as HTML.

function element(className: string, text = ''): HTMLDivElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}

/** A trail's rank in its colour; faded while another trail is selected. */
export function badgeElement({
  rank,
  color,
  emphasised,
}: {
  rank: number;
  color: string;
  emphasised: boolean;
}): HTMLElement {
  const node = element('ptb-badge', String(rank));
  node.style.background = color;
  node.style.opacity = emphasised ? '1' : '0.55';
  return node;
}

export function parkingElement(): HTMLElement {
  return element('ptb-parking', 'P');
}

export function foundElement(): HTMLElement {
  return element('ptb-found', '✓');
}

export function targetPulseElement(): HTMLElement {
  return element('ptb-target-pulse');
}

/** The user's dot, with a cone pointing where they face when the heading is known. */
export function positionElement(heading?: number): HTMLElement {
  const node = element('ptb-position');
  if (heading !== undefined) {
    const cone = element('ptb-position__cone');
    cone.style.transform = `rotate(${heading}deg)`;
    node.append(cone);
  }
  node.append(element('ptb-position__dot'));
  return node;
}

/** A tooltip's content, as a text node. */
export function textElement(text: string): HTMLElement {
  const node = document.createElement('span');
  node.textContent = text;
  return node;
}
