/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { BuildMenu } from './BuildMenu';

afterEach(() => {
  cleanup();
});

const catalog = {
  buildings: [
    { id: 'hut', name: 'Hut', footprint: [1, 1], cost: { wood: 5 } },
    { id: 'farm', name: 'Farm', footprint: [3, 3], cost: { wood: 10 }, unlockConditions: { minPopulation: 2 } },
  ],
  crops: [
    { id: 'wheat', name: 'Wheat', seasons: ['spring'], stages: 4 },
  ],
};

describe('BuildMenu', () => {
  it('renders correctly', () => {
    const onSelectKind = vi.fn();
    const onSelectCrop = vi.fn();
    const onDemolish = vi.fn();

    render(
      <BuildMenu
        catalog={catalog as any}
        selectedKind={null}
        selectedCrop={null}
        selectedBuildingId={null}
        villagerDetail={null}
        unlocked={['hut']}
        onSelectKind={onSelectKind}
        onSelectCrop={onSelectCrop}
        onDemolish={onDemolish}
      />
    );

    expect(screen.getByText('Hut')).toBeTruthy();
    expect(screen.getByText('Farm')).toBeTruthy();
    expect(screen.getByText('Wheat')).toBeTruthy();
  });

  it('handles crop selection', () => {
    const onSelectCrop = vi.fn();
    render(
      <BuildMenu
        catalog={catalog as any}
        selectedKind={null}
        selectedCrop={null}
        selectedBuildingId={null}
        villagerDetail={null}
        unlocked={['hut']}
        onSelectKind={vi.fn()}
        onSelectCrop={onSelectCrop}
        onDemolish={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wheat/i }));
    expect(onSelectCrop).toHaveBeenCalledWith('wheat');
  });

  it('handles building selection for unlocked buildings', () => {
    const onSelectKind = vi.fn();
    render(
      <BuildMenu
        catalog={catalog as any}
        selectedKind={null}
        selectedCrop={null}
        selectedBuildingId={null}
        villagerDetail={null}
        unlocked={['hut']}
        onSelectKind={onSelectKind}
        onSelectCrop={vi.fn()}
        onDemolish={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Hut/i }));
    expect(onSelectKind).toHaveBeenCalledWith('hut');
  });

  it('prevents selection of locked buildings', () => {
    const onSelectKind = vi.fn();
    render(
      <BuildMenu
        catalog={catalog as any}
        selectedKind={null}
        selectedCrop={null}
        selectedBuildingId={null}
        villagerDetail={null}
        unlocked={['hut']}
        onSelectKind={onSelectKind}
        onSelectCrop={vi.fn()}
        onDemolish={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /Farm/i });
    fireEvent.click(button);
    expect(onSelectKind).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });
});
