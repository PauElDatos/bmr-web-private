import { escapeHtml } from '../utils/format.js';

export function selectBox(id, label, options, selected = '') {
  return `
    <label class="field-label" for="${id}">${escapeHtml(label)}</label>
    <select id="${id}" class="select-input">
      ${options.map(o => {
        const value = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('')}
    </select>
  `;
}

export function checkBox(id, label, checked = false) {
  return `<label class="check"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} /> <span>${escapeHtml(label)}</span></label>`;
}
