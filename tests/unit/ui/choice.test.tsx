import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip, ChoiceCard, ChoiceGrid, SegmentedControl } from '@/components/ui/choice';

/**
 * Choice primitives.
 *
 * The reason these are native inputs rather than divs with click handlers is
 * the only thing worth testing about them. A `role="radio"` div needs roving
 * focus, arrow keys, form association and group semantics reimplemented by
 * hand; a real `<input>` has all four, correctly, for free.
 */

describe('ChoiceGrid — the group carries the question', () => {
  it('groups options under the question as a fieldset', () => {
    const { container } = render(
      <ChoiceGrid label="What are you building?">
        <ChoiceCard name="stage" value="idea" label="Just an idea" />
      </ChoiceGrid>,
    );

    expect(container.querySelector('fieldset')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /what are you building/i })).toBeInTheDocument();
  });

  it('explains why Foundry is asking, when told', () => {
    // A founder handing over business facts is owed a reason.
    render(
      <ChoiceGrid
        label="What are you building?"
        description="This helps Foundry narrow down which requirements may apply."
      >
        <ChoiceCard name="stage" value="idea" label="Just an idea" />
      </ChoiceGrid>,
    );

    expect(screen.getByText(/narrow down which requirements/i)).toBeInTheDocument();
  });
});

describe('ChoiceCard — a real input, visually replaced', () => {
  it('renders a radio the browser owns', () => {
    render(<ChoiceCard name="stage" value="idea" label="Just an idea" />);
    expect(screen.getByRole('radio', { name: /just an idea/i })).toBeInTheDocument();
  });

  it('supports checkboxes for questions with several answers', () => {
    render(<ChoiceCard type="checkbox" name="goals" value="premises" label="Open a location" />);
    expect(screen.getByRole('checkbox', { name: /open a location/i })).toBeInTheDocument();
  });

  it('associates the label so the whole card is the hit target', () => {
    render(<ChoiceCard name="stage" value="idea" label="Just an idea" hint="Nothing built yet" />);
    // Found by accessible name ⇒ the label is associated, not merely adjacent.
    expect(screen.getByRole('radio', { name: /just an idea/i })).toBeInTheDocument();
    expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
  });

  it('keeps the input in the accessibility tree rather than hiding it', () => {
    // `sr-only`, never `display:none` or `aria-hidden` — a hidden input is
    // unreachable by keyboard and invisible to a screen reader.
    render(<ChoiceCard name="stage" value="idea" label="Just an idea" />);
    const input = screen.getByRole('radio');

    expect(input).toHaveClass('sr-only');
    expect(input).not.toHaveAttribute('aria-hidden');
  });

  it('reflects a default selection', () => {
    render(<ChoiceCard name="stage" value="idea" label="Just an idea" defaultChecked />);
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('submits the value the schema expects', () => {
    // The controlled vocabulary lives in `lib/validation/intake.ts`. The card
    // passes it through untouched.
    render(<ChoiceCard name="stage" value="pre_launch" label="Getting ready to launch" />);
    expect(screen.getByRole('radio')).toHaveAttribute('value', 'pre_launch');
  });
});

describe('SegmentedControl — one track, still radios', () => {
  const OPTIONS = [
    { value: '1', label: 'Just me' },
    { value: '2-5', label: '2–5' },
    { value: '6-20', label: '6–20' },
  ];

  it('renders a labelled group of radios', () => {
    render(<SegmentedControl name="team" label="How many people?" options={OPTIONS} />);

    expect(screen.getByRole('group', { name: /how many people/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marks the default without needing client state', () => {
    render(
      <SegmentedControl
        name="team"
        label="How many people?"
        options={OPTIONS}
        defaultValue="2-5"
      />,
    );
    expect(screen.getByRole('radio', { name: '2–5' })).toBeChecked();
  });
});

describe('Chip — a button, not a clickable div', () => {
  it('is reachable and operable by keyboard', () => {
    render(<Chip>What records must I keep?</Chip>);
    expect(screen.getByRole('button', { name: /what records/i })).toBeInTheDocument();
  });

  it('reports selection to assistive technology', () => {
    render(<Chip selected>Licensing</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the outline tone for a chip that demonstrates a boundary', () => {
    // The question Nova is expected to decline. Visibly different before it is
    // read, so the refusal does not look like a failure.
    render(<Chip tone="outline">What is the VAT rate in The Bahamas?</Chip>);
    expect(screen.getByRole('button')).toHaveClass('border-dashed');
  });

  it('never submits a form it happens to sit inside', () => {
    render(<Chip>Licensing</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
