/**
 * UI COMPONENTS - POPOMUS
 * Themed replacements for the browser's native <select> menus and confirm() boxes.
 *
 * - CustomSelect enhances any <select data-custom-select>. The native element stays in the
 *   DOM (hidden) as the source of truth, so `select.value` keeps working everywhere.
 * - Confirm.ask() returns a Promise<boolean> backed by #confirmDialog.
 * - Toast.show() displays a short, non-blocking status message (replaces alert()).
 */

const CustomSelect = {
  _instances: [],
  _open: null,

  init(root = document) {
    root.querySelectorAll('select[data-custom-select]').forEach(select => {
      if (!select._customSelect) this._instances.push(this._enhance(select));
    });
  },

  /** Re-reads every native select value (call after setting `select.value` from code). */
  refreshAll() {
    this._instances.forEach(inst => inst.refresh());
  },

  closeOpen() {
    if (this._open) this._open.close();
  },

  _enhance(select) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cselect';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cselect-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);
    trigger.innerHTML = `
      <span class="cselect-value"></span>
      <svg class="cselect-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;
    const valueEl = trigger.querySelector('.cselect-value');

    const menu = document.createElement('div');
    menu.className = 'cselect-menu';
    menu.id = `${select.id || 'cselect'}-listbox`;
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;
    menu.hidden = true;
    trigger.setAttribute('aria-controls', menu.id);

    select.classList.add('cselect-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger);

    // Menus are portaled into the surrounding <dialog> (top layer) or <body>, positioned with fixed coords
    const host = () => select.closest('dialog') || document.body;

    const options = () => Array.from(select.options);
    let activeIndex = -1;

    const render = () => {
      menu.innerHTML = options().map((opt, i) => `
        <div class="cselect-option" role="option" id="${menu.id}-${i}" data-index="${i}" aria-selected="${opt.selected}">
          <span class="cselect-option-text">
            <span class="cselect-option-label">${escapeText(opt.textContent)}</span>
            ${opt.dataset.desc ? `<span class="cselect-option-desc">${escapeText(opt.dataset.desc)}</span>` : ''}
          </span>
          <svg class="cselect-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      `).join('');
    };

    const setActive = (index, scroll = true) => {
      const items = menu.querySelectorAll('.cselect-option');
      if (!items.length) return;
      activeIndex = Math.min(items.length - 1, Math.max(0, index));
      items.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
      menu.setAttribute('aria-activedescendant', items[activeIndex].id);
      if (scroll) items[activeIndex].scrollIntoView({ block: 'nearest' });
    };

    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      menu.style.minWidth = `${rect.width}px`;
      menu.style.maxWidth = `${window.innerWidth - margin * 2}px`;
      const menuRect = menu.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const openUp = menuRect.height > below && above > below;
      const maxHeight = Math.max(120, openUp ? above : below);
      menu.style.maxHeight = `${maxHeight}px`;
      const height = Math.min(menuRect.height, maxHeight);
      const left = Math.min(Math.max(margin, rect.right - menuRect.width), window.innerWidth - menuRect.width - margin);
      menu.style.left = `${left}px`;
      menu.style.top = `${openUp ? rect.top - height - 6 : rect.bottom + 6}px`;
      menu.classList.toggle('opens-up', openUp);
    };

    const instance = {
      select,
      isOpen: false,

      refresh() {
        const selected = select.options[select.selectedIndex];
        valueEl.textContent = selected ? selected.textContent : '';
        render();
      },

      open() {
        if (this.isOpen || select.disabled) return;
        CustomSelect.closeOpen();
        this.isOpen = true;
        CustomSelect._open = this;
        render();
        host().appendChild(menu);
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        wrapper.classList.add('is-open');
        position();
        setActive(select.selectedIndex);
        menu.focus({ preventScroll: true });
      },

      close(returnFocus = true) {
        if (!this.isOpen) return;
        this.isOpen = false;
        if (CustomSelect._open === this) CustomSelect._open = null;
        menu.hidden = true;
        menu.remove();
        trigger.setAttribute('aria-expanded', 'false');
        wrapper.classList.remove('is-open');
        if (returnFocus) trigger.focus({ preventScroll: true });
      },

      choose(index) {
        const opts = options();
        if (!opts[index]) return;
        const changed = select.selectedIndex !== index;
        select.selectedIndex = index;
        this.refresh();
        this.close();
        if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
      },

      reposition: position
    };
    select._customSelect = instance;

    trigger.addEventListener('click', () => (instance.isOpen ? instance.close() : instance.open()));
    trigger.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        instance.open();
      }
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.cselect-option');
      if (item) instance.choose(Number(item.dataset.index));
    });
    menu.addEventListener('mousemove', (e) => {
      const item = e.target.closest('.cselect-option');
      if (item && Number(item.dataset.index) !== activeIndex) setActive(Number(item.dataset.index), false);
    });
    menu.addEventListener('keydown', (e) => {
      const count = options().length;
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive((activeIndex + 1) % count); break;
        case 'ArrowUp': e.preventDefault(); setActive((activeIndex - 1 + count) % count); break;
        case 'Home': e.preventDefault(); setActive(0); break;
        case 'End': e.preventDefault(); setActive(count - 1); break;
        case 'Enter':
        case ' ': e.preventDefault(); instance.choose(activeIndex); break;
        case 'Escape': e.preventDefault(); e.stopPropagation(); instance.close(); break;
        case 'Tab': instance.close(false); break;
        default: {
          // Type-ahead: jump to the first option starting with the typed letter
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const match = options().findIndex(o => o.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
            if (match !== -1) setActive(match);
          }
        }
      }
    });

    // Keep the label in sync when the native value changes through any route
    select.addEventListener('change', () => instance.refresh());
    instance.refresh();
    return instance;
  }
};

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Outside click, resize and dialog-dismiss handling for the open menu
document.addEventListener('mousedown', (e) => {
  const open = CustomSelect._open;
  if (!open) return;
  const wrapper = open.select.parentNode;
  if (!wrapper.contains(e.target) && !e.target.closest('.cselect-menu')) open.close(false);
}, true);
window.addEventListener('resize', () => CustomSelect._open?.reposition());
// Esc on a <dialog> closes the dialog; while a menu is open it should only close the menu
document.addEventListener('cancel', (e) => {
  if (CustomSelect._open) {
    e.preventDefault();
    CustomSelect.closeOpen();
  }
}, true);
document.addEventListener('scroll', (e) => {
  if (CustomSelect._open && !e.target.closest?.('.cselect-menu')) CustomSelect._open.reposition();
}, true);

const Confirm = {
  _resolve: null,

  /**
   * @param {{title: string, message: string, confirmText?: string, cancelText?: string, danger?: boolean}} opts
   * @returns {Promise<boolean>}
   */
  ask({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    const dialog = document.getElementById('confirmDialog');
    if (!dialog) return Promise.resolve(window.confirm(message));
    if (this._resolve) this._finish(false);

    dialog.querySelector('#confirmTitle').textContent = title;
    dialog.querySelector('#confirmMessage').textContent = message;
    const okBtn = dialog.querySelector('#btnConfirmOk');
    const cancelBtn = dialog.querySelector('#btnConfirmCancel');
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.classList.toggle('is-danger', danger);
    dialog.classList.toggle('is-danger', danger);

    return new Promise(resolve => {
      this._resolve = resolve;
      dialog.showModal();
      // Destructive actions default focus to Cancel so Enter can't delete by accident
      (danger ? cancelBtn : okBtn).focus();
    });
  },

  _finish(result) {
    const dialog = document.getElementById('confirmDialog');
    const resolve = this._resolve;
    this._resolve = null;
    if (dialog?.open) dialog.close();
    if (resolve) resolve(result);
  },

  init() {
    const dialog = document.getElementById('confirmDialog');
    if (!dialog) return;
    dialog.querySelector('#btnConfirmOk').addEventListener('click', () => this._finish(true));
    dialog.querySelector('#btnConfirmCancel').addEventListener('click', () => this._finish(false));
    // Esc and backdrop clicks count as cancel
    dialog.addEventListener('close', () => { if (this._resolve) this._finish(false); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) this._finish(false); });
  }
};

const Toast = {
  _timeout: null,

  /** @param {string} message @param {{type?: 'info'|'error', duration?: number}} [opts] */
  show(message, { type = 'info', duration = 2800 } = {}) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
    }
    // Inside an open modal the toast must live in the dialog (top layer) to be visible
    const host = document.querySelector('dialog[open]') || document.body;
    if (toast.parentNode !== host) host.appendChild(toast);

    toast.textContent = message;
    toast.classList.toggle('is-error', type === 'error');
    toast.classList.add('show');
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  CustomSelect.init();
  Confirm.init();
});

if (typeof window !== 'undefined') {
  window.CustomSelect = CustomSelect;
  window.Confirm = Confirm;
  window.Toast = Toast;
}
