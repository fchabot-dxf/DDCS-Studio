/** views/wcsView.js — WCS wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { WCSWizard } from '../wcsWizard.js';

const wizard = new WCSWizard();

export const wcsView = {
    type: 'wcs',
    panelId: 'wiz_wcs',
    codeElId: 'wiz_wcs_code',
    large: false,
    inputIds: ['w_sys', 'w_x', 'w_y', 'w_z', 'w_sync', 'w_slave'],

    update() {
        const params = {
            sys: el('w_sys').value,
            axisX: el('w_x')?.checked || false,
            axisY: el('w_y')?.checked || false,
            axisZ: el('w_z')?.checked || false,
            sync: el('w_sync')?.checked || false,
            slave: el('w_slave')?.value || '3'
        };

        const gcode = wizard.generate(params);
        el('wiz_wcs_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update status label with human-friendly WCS name and base address
        const wcsStatus = el('wcsStatus');
        if (wcsStatus) wcsStatus.textContent = `${wizard.getWCSName(params.sys)} - Base: ${wizard.getWCSBase(params.sys)}`;
    },
};
