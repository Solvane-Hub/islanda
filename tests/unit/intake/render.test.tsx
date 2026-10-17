import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IntakeProgress, type RailSlot } from '@/app/(app)/intake/_components/progress';
import { TeamSize } from '@/app/(app)/intake/_components/team-size';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * Intake UI contracts.
 *
 * These guard the parts of the redesign that could silently break something
 * real: the progress semantics the original implementation shipped, the
 * label↔control association the whole flow's accessibility and its end-to-end
 * test depend on, and the fact that the enlarged question label is still a
 * label rather than a decorative heading.
 */
const SLOTS: RailSlot[] = [
  { step: 1, label: 'Business', known: true },
  { step: 2, label: 'Stage', known: true },
  { step: 3, label: 'Team', known: true },
  { step: 4, label: 'Funding', known: false },
  { step: 5, label: 'Goals', known: false },
];

describe('IntakeProgress', () => {
  it('keeps the progressbar contract and reports answered steps, not the step on screen', () => {
    // Viewing step 4 having answered 3 is the normal case; the bar must not
    // claim the question in front of the founder is already done.
    render(<IntakeProgress completed={3} total={5} current={4} title="Funding" slots={SLOTS} />);
    const bar = screen.getByRole('progressbar', { name: 'Intake progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 5 answered');
  });

  it('reads out what is answered, not which page the founder is on', () => {
    render(
      <IntakeProgress
        completed={0}
        total={5}
        current={1}
        title="About the business"
        slots={SLOTS.map((s) => ({ ...s, known: false }))}
      />,
    );
    // Standing on step 1 with nothing established is 00 of 05, not 01 of 05 —
    // the readout is knowledge, and the current position is named separately.
    expect(screen.getByText('00')).toBeTruthy();
    expect(screen.getByText('/ 05')).toBeTruthy();
    expect(screen.getByText('About the business')).toBeTruthy();
  });

  it('names every slot and says its condition in words, not only in colour', () => {
    render(<IntakeProgress completed={3} total={5} current={4} title="Funding" slots={SLOTS} />);
    const rail = screen.getByRole('navigation', { name: 'Intake sections' });
    // Keep all five short labels in one readable row at a 390px viewport.
    expect(rail.querySelector('ol')).toHaveClass('grid-cols-5');
    for (const label of ['Business', 'Stage', 'Team', 'Funding', 'Goals']) {
      expect(within(rail).getByText(label)).toBeTruthy();
    }
    expect(within(rail).getAllByText('answered')).toHaveLength(3);
    expect(within(rail).getByText('current question, not answered yet')).toBeTruthy();
    expect(within(rail).getByText('not answered yet')).toBeTruthy();
  });

  it('links back to established slots and nowhere else', () => {
    render(<IntakeProgress completed={3} total={5} current={4} title="Funding" slots={SLOTS} />);
    const rail = screen.getByRole('navigation', { name: 'Intake sections' });
    expect(within(rail).getAllByRole('link')).toHaveLength(3);
    expect(within(rail).getByRole('link', { name: /Stage/ })).toHaveAttribute(
      'href',
      '/intake?step=2',
    );
  });
});

describe('Field, question size', () => {
  it('renders the focal question as the control label, not as a second heading', () => {
    render(
      <Field id="description" size="question" label="What does the business do?">
        {(aria) => <Input {...aria} name="description" />}
      </Field>,
    );
    // The end-to-end journey addresses this control by its label text.
    expect(screen.getByLabelText('What does the business do?')).toHaveAttribute(
      'name',
      'description',
    );
    // A heading here would duplicate the accessible name and break the
    // page's heading order.
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('keeps description and error wired to the control', () => {
    render(
      <Field
        id="location"
        size="question"
        label="Where will it operate?"
        description="An island, city or area is enough."
        error="Where will the business operate?"
      >
        {(aria) => <Input {...aria} name="location" />}
      </Field>,
    );
    const input = screen.getByLabelText('Where will it operate?');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('location-error');
    expect(input.getAttribute('aria-describedby')).toContain('location-description');
    expect(screen.getByRole('alert')).toHaveTextContent('Where will the business operate?');
  });
});

describe('TeamSize', () => {
  const props = {
    id: 'employeeCount',
    name: 'employeeCount',
    'aria-invalid': false,
    'aria-describedby': undefined,
  };

  it('exposes a real number input that a label and a fill can address', () => {
    render(
      <Field id="employeeCount" label="How many people will work in the business?">
        {(aria) => <TeamSize {...aria} name="employeeCount" defaultValue={3} />}
      </Field>,
    );
    const input = screen.getByLabelText('How many people will work in the business?');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveValue(3);
  });

  it('nudges the value in both directions through named buttons', () => {
    render(<TeamSize {...props} defaultValue={2} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    expect(input).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer people' }));
    expect(input).toHaveValue(2);
  });

  it('never goes below the minimum', () => {
    render(<TeamSize {...props} defaultValue={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer people' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
  });
});
