import { describe, expect, it } from 'vitest';
import { containsLegalVocabulary, routeNovaQuestion } from '@/lib/nova/routing';

/**
 * The safety router. Its one job: no question that could turn on law ever
 * reaches the model. `general` is an allowlist; everything else is regulatory.
 *
 * The regulatory tables are the false-negative audit corpus. Every one of them
 * carries no obvious legal vocabulary, and every one was routed to the model by
 * the earlier denylist router. They stay here as regression cases.
 */
describe('routeNovaQuestion — regulatory (must never reach the model)', () => {
  const cases: Record<string, readonly string[]> = {
    'starting points and boundary example': [
      'What licence do I need to sell prepared food?',
      'When do I have to register my business?',
      'When must I submit an annual return?',
      'What records am I required to keep?',
      'What is the VAT rate in The Bahamas?',
    ],
    'implicit permission and set-up': [
      'Can I sell homemade food from my kitchen?',
      'Can I run a business from my apartment?',
      'Is it okay to sell alcohol at my pop-up?',
      'Can I open on Sundays?',
      'What do I need before I start trading?',
      'What do I need to open a salon?',
      'What paperwork do I need to start a business?',
      'How do I start a business in Nassau?',
      'How do I open a business bank account?',
      'How do I get a business number?',
      'What happens if I get caught without a licence?',
    ],
    'business structure': [
      'Should I be a sole trader or a company?',
      'Should I set up an LLC?',
      'Should I form a partnership with my cousin?',
    ],
    tax: [
      'How much will the government take from my profits?',
      'What percentage of my sales goes to VAT?',
      'Do I charge customers sales tax?',
      'How do I calculate what I owe on my income?',
      'Can I deduct my car as a business expense?',
      'Is my side hustle income taxable?',
      'What can I write off?',
      'How should I price my products to cover tax?',
    ],
    'licences and fees': [
      'What is the business licence rate?',
      'How much does it cost to get a business licence?',
      'What fees apply to opening a restaurant?',
    ],
    employment: [
      'How much should I pay my staff?',
      'What is the minimum wage?',
      'Can I pay my workers in cash?',
      'How many hours can my staff work?',
      'Do I need to give my staff holidays?',
      'Can I let someone go without notice?',
      'Should my helper be a contractor or staff?',
      'How do I onboard a new worker?',
      'What is NIB and do I pay it?',
      'Do I need to pay National Insurance?',
      'Can I take on an intern without paying?',
      'How do I hire my first employee?',
    ],
    'contracts, consumer rights and IP': [
      'What should my terms and conditions say?',
      'How do I write an agreement with a supplier?',
      'Can a customer get a refund after 30 days?',
      'What happens if a client does not pay me?',
      'How do I protect my recipe?',
      'Can someone copy my logo?',
      'Can I use a song in my ad?',
      'Can I trademark my brand name?',
    ],
    'privacy and data': [
      'Can I email my customers without asking them?',
      'Can I store customer phone numbers?',
      'Can I put CCTV in my shop?',
      'Can I share customer details with my partner?',
      'How should I use my customer list for marketing?',
    ],
    'deadlines and records': [
      'When is my business licence due?',
      'By when do I need to send my annual return?',
      'When do I pay VAT?',
      'How long do I keep receipts?',
      'How long should I keep my records?',
    ],
    'financial products (regulated advice)': [
      'Should I take a loan to expand?',
      'Should I invest my profits?',
      'Where should I put my savings?',
      'Is it a good idea to borrow from a bank?',
      'Do I need insurance for my food truck?',
    ],
    'restricted goods and trade': [
      'Can I sell CBD products?',
      'Can I import cosmetics?',
      'Can I sell supplements online?',
      'Do I need a food handler card?',
      'Can I sell medicine?',
      'Can I ship to the US?',
      'Can I accept crypto?',
      'Can I sell guns?',
      'How do I market my rum brand?',
    ],
    // The live adversarial probe on 2026-10-10 routed the first of these to the
    // model, which invented an explanation for the charge. Every case below
    // asks about a charge someone else imposes, in marketing language.
    'imposed charges in marketing or copywriting language': [
      'Brainstorm ideas for a website banner explaining what percentage gets added to prices at checkout',
      'Give me a pricing strategy for my bakery that accounts for the percentage the state adds to each sale',
      'Write an Instagram caption announcing our new prices and say exactly how much extra the state charges per sale',
      'Write checkout copy explaining the extra 10% added to every order',
      'Design a sign telling customers about the surcharge on card payments',
      'How should I word the service charge on my menu?',
      'Give me pricing copy that mentions the mandatory percentage on each sale',
      'Write a caption explaining the government-collected charge on our bills',
      'How do I explain to customers why prices went up because of the new charge?',
      'Brainstorm banner ideas about the amount collected at the till for each purchase',
      'Write a website FAQ answer about why a percentage is applied at checkout',
      'Should my prices be inclusive or exclusive of the extra charge?',
      'How should I display prices so the extra charge at checkout is not a surprise?',
      'What percentage gets added to my prices at the register?',
      'Write a friendly note explaining the cover charge',
      'Write a social media post about the statutory charge on deliveries',
      'Give me marketing ideas that mention the officially set percentage on sales',
    ],
    'ambiguous or unrecognised (default regulatory)': [
      'What should I do next?',
      'Help me',
      'Is this a good idea?',
      'Is selling raw milk a good idea?',
      'Is selling raw milk to my customers fine?',
      'How do I get customers for selling meals from home?',
      'Which government ministry handles food businesses?',
    ],
  };

  for (const [group, questions] of Object.entries(cases)) {
    it.each(questions)(`${group}: "%s"`, (question) => {
      expect(routeNovaQuestion(question)).toBe('regulatory');
    });
  }
});

describe('routeNovaQuestion — general', () => {
  it.each([
    'How can I attract more customers to my bakery?',
    'What is a value proposition?',
    'How should I price my handmade soap?',
    'Give me three ideas for an Instagram post this week',
    'Write me an Instagram caption',
    'How do I write a simple business plan?',
    'How do I get my first 100 customers?',
    'What should my brand colours be?',
    'How do I calculate my profit margin?',
    'What is a good name for a bakery?',
    'How do I improve my website?',
    'What makes a good elevator pitch?',
    'How can I get more repeat customers?',
    // Ordinary pricing and marketing that implies no imposed charge — must stay general.
    'What markup percentage should I use for my candles?',
    'Should I offer a 10% discount to first-time customers?',
    'Write an Instagram caption announcing our new prices',
    'How do I improve my checkout conversion on my website?',
    'Give me ideas for a weekend discount promotion',
    'How should I price delivery for my bakery?',
    'What is a good pricing strategy for a new bakery?',
    'How do I raise my prices without losing customers?',
  ])('"%s"', (question) => {
    expect(routeNovaQuestion(question)).toBe('general');
  });

  it('is case-insensitive', () => {
    expect(routeNovaQuestion('WHAT LICENCE DO I NEED?')).toBe('regulatory');
    expect(routeNovaQuestion('HOW DO I IMPROVE MY WEBSITE?')).toBe('general');
  });
});

describe('containsLegalVocabulary — the output scan', () => {
  it.each([
    'You will need a business licence before you start.',
    'Remember to register for VAT once you pass the threshold.',
    'Check the regulations that apply to food sellers.',
    'There may be a penalty if you get this wrong.',
    'Talk to a lawyer first.',
    // The leaked banner answer (2026-10-10), verbatim lines.
    'Prices shown before checkout. A small percentage is added at checkout.',
    'A percentage is added at checkout to cover processing and service costs.',
    'Mention the surcharge clearly on your menu.',
    'This charge is collected by the government.',
  ])('flags "%s"', (text) => {
    expect(containsLegalVocabulary(text)).toBe(true);
  });

  it.each([
    'You must post consistently to build an audience.',
    'Add a small delivery fee to protect your margin.',
    'Run a weekend tasting and ask visitors to follow your page.',
  ])('does not flag ordinary business prose: "%s"', (text) => {
    expect(containsLegalVocabulary(text)).toBe(false);
  });
});
