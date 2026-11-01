import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SaveDialog, SAVE_DIALOG_BACKDROP_CLASS } from './SaveDialog';
import { ClockBar } from './ClockBar';
import { BuildMenu } from './BuildMenu';

describe('SaveDialog backdrop and surrounding control guards', () => {
  it('renders a fixed full-viewport modal backdrop so header and build menu are covered', () => {
    expect(SAVE_DIALOG_BACKDROP_CLASS).toContain('fixed');
    expect(SAVE_DIALOG_BACKDROP_CLASS).toContain('inset-0');
    expect(SAVE_DIALOG_BACKDROP_CLASS).toContain('z-40');

    const html = renderToStaticMarkup(
      createElement(SaveDialog, {
        focus: 'load',
        currentSave: null,
        onSaveEvent: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain('data-testid="save-dialog-backdrop"');
    expect(html).toContain('fixed inset-0 z-40');
    expect(html).toContain('aria-modal="true"');
  });

  it('disables ClockBar speed buttons and BuildMenu actions when disabled is true', () => {
    const clockHtml = renderToStaticMarkup(
      createElement(ClockBar, {
        clock: { minute: 480, day: 1, season: 0, year: 1, speed: 0, weather: 0 },
        disabled: true,
        onSetSpeed: () => {},
      }),
    );
    const speedButtons = clockHtml.match(/<button[^>]*>/g) ?? [];
    expect(speedButtons).toHaveLength(4);
    for (const button of speedButtons) {
      expect(button).toContain('disabled=""');
    }

    const menuHtml = renderToStaticMarkup(
      createElement(BuildMenu, {
        catalog: {
          buildings: [
            {
              id: 'hut',
              name: 'Hut',
              footprint: [2, 2],
              cost: { wood: 10 },
              buildTicks: 20,
              category: 'housing',
              validTerrain: ['grass'],
            },
          ],
          crops: [
            {
              id: 'wheat',
              name: 'Wheat',
              stages: 4,
              ticksPerStage: 20,
              seasons: ['Spring'],
              waterRequired: true,
            },
          ],
        },
        selectedKind: null,
        selectedCrop: null,
        selectedBuildingId: 1,
        villagerDetail: null,
        unlocked: ['hut'],
        disabled: true,
        onSelectKind: () => {},
        onSelectCrop: () => {},
        onDemolish: () => {},
      }),
    );
    const menuButtons = menuHtml.match(/<button[^>]*>/g) ?? [];
    expect(menuButtons.length).toBeGreaterThanOrEqual(3);
    for (const button of menuButtons) {
      expect(button).toContain('disabled=""');
    }
  });
});
