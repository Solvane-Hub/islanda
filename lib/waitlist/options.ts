import { Constants, type Database } from '@/types/database';

/**
 * The waitlist questionnaire and recruitment vocabulary — one place for the
 * stored value and the words a person sees, so the public questionnaire, the
 * validation schema and the team's admin views can never drift apart.
 *
 * The labels are the exact wording agreed for the questionnaire. Change them
 * here, and only together with the product owner: the admin filters, reports
 * and exports read the same labels.
 */

type Enums = Database['public']['Enums'];

export type BusinessStage = Enums['waitlist_business_stage'];
export type BusinessJourney = Enums['waitlist_business_journey'];
export type Industry = Enums['waitlist_industry'];
export type PrimaryGoal = Enums['waitlist_primary_goal'];
export type BiggestChallenge = Enums['waitlist_challenge'];
export type TestingInterest = Enums['waitlist_testing_interest'];
export type RecruitmentStatus = Enums['waitlist_recruitment_status'];

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Q3 — Where are you in your business journey? */
export const BUSINESS_JOURNEY_OPTIONS = [
  { value: 'idea_not_started', label: "I have an idea but haven't started yet" },
  { value: 'planning_new_business', label: "I'm planning to start a new business" },
  { value: 'preparing_to_register', label: "I'm preparing to register my business" },
  {
    value: 'operating_not_established',
    label: "I've started operating but am not fully established yet",
  },
  { value: 'established_business', label: 'I already run an established business' },
  { value: 'starting_another_business', label: "I'm starting another business" },
  {
    value: 'exploring_ownership',
    label: "I'm exploring business ownership and haven't decided yet",
  },
  { value: 'other', label: 'Other' },
] as const satisfies readonly Option<BusinessJourney>[];

/** Q4 — What industry is your business in? */
export const INDUSTRY_OPTIONS = [
  { value: 'food_restaurants_catering', label: 'Food, Restaurants & Catering' },
  { value: 'tourism_travel_hospitality', label: 'Tourism, Travel & Hospitality' },
  { value: 'retail_online_shopping', label: 'Retail & Online Shopping' },
  { value: 'beauty_hair_personal_care', label: 'Beauty, Hair & Personal Care' },
  { value: 'fashion_clothing', label: 'Fashion & Clothing' },
  { value: 'construction_home_improvement', label: 'Construction & Home Improvement' },
  { value: 'real_estate_property', label: 'Real Estate & Property Management' },
  { value: 'professional_services_consulting', label: 'Professional Services & Consulting' },
  { value: 'technology_software', label: 'Technology & Software' },
  { value: 'media_marketing_creative', label: 'Media, Marketing & Creative Services' },
  { value: 'transportation_logistics', label: 'Transportation & Logistics' },
  { value: 'agriculture_fishing_food_production', label: 'Agriculture, Fishing & Food Production' },
  { value: 'healthcare_wellness', label: 'Healthcare & Wellness' },
  { value: 'education_training', label: 'Education & Training' },
  { value: 'financial_accounting', label: 'Financial & Accounting Services' },
  { value: 'manufacturing_product_development', label: 'Manufacturing & Product Development' },
  { value: 'entertainment_events_recreation', label: 'Entertainment, Events & Recreation' },
  { value: 'cleaning_maintenance', label: 'Cleaning & Maintenance' },
  { value: 'automotive_services', label: 'Automotive Services' },
  { value: 'nonprofit_community', label: 'Nonprofit & Community Organizations' },
  { value: 'other', label: 'Other' },
  { value: 'not_sure_yet', label: 'Not Sure Yet' },
] as const satisfies readonly Option<Industry>[];

/** Q5 — What would you most like Islanda to help you with? */
export const PRIMARY_GOAL_OPTIONS = [
  { value: 'start_a_business', label: 'Understand how to start a business' },
  { value: 'register_my_business', label: 'Understand how to register my business' },
  {
    value: 'licences_permits_approvals',
    label: 'Figure out what licences, permits, or approvals I may need',
  },
  {
    value: 'government_requirements',
    label: 'Understand government requirements and official business rules',
  },
  { value: 'reliable_information', label: 'Find reliable information about running a business' },
  { value: 'clear_plan', label: 'Create a clear plan for starting or growing my business' },
  { value: 'next_steps', label: 'Decide what steps I should take next' },
  {
    value: 'organize_documents',
    label: 'Organize my business documents and important information',
  },
  { value: 'finances_budgeting', label: 'Understand my business finances, costs, and budgeting' },
  { value: 'goals_progress', label: 'Set goals and track my business progress' },
  { value: 'find_customers', label: 'Find customers and attract more business' },
  { value: 'marketing_social_media', label: 'Improve my marketing and social media' },
  {
    value: 'daily_operations',
    label: 'Improve daily operations and manage my business more efficiently',
  },
  { value: 'funding_investment', label: 'Prepare my business for funding or investment' },
  { value: 'prepare_to_launch', label: 'Understand what my business needs before launching' },
  {
    value: 'requirements_deadlines',
    label: 'Keep up with important business requirements and deadlines',
  },
  { value: 'evaluate_idea', label: 'Explore whether a business idea is worth pursuing' },
  { value: 'industry_questions', label: 'Get answers to questions specific to my industry' },
  { value: 'other', label: 'Other' },
  { value: 'not_sure_yet', label: "I'm not sure yet" },
] as const satisfies readonly Option<PrimaryGoal>[];

/**
 * Q6 — the biggest challenge. These are the options OFFERED today. The stored
 * enum also keeps `managing_business`, an answer from the October 2026
 * questionnaire; it still has a label (below) but is no longer offered.
 */
export const CHALLENGE_OPTIONS = [
  { value: 'finding_information', label: 'Finding reliable information' },
  {
    value: 'understanding_registration',
    label: 'Understanding registration and legal requirements',
  },
  { value: 'knowing_next_steps', label: 'Knowing what to do next' },
  { value: 'getting_started', label: 'Getting my business started' },
  { value: 'organizing_documents', label: 'Organizing documents and information' },
  { value: 'managing_money', label: 'Managing money and expenses' },
  { value: 'finding_customers', label: 'Finding customers' },
  { value: 'marketing', label: 'Marketing my business' },
  { value: 'day_to_day_operations', label: 'Managing day-to-day operations' },
  { value: 'industry_requirements', label: 'Understanding industry-specific requirements' },
  { value: 'finding_funding', label: 'Finding funding or financial support' },
  { value: 'deadlines_requirements', label: 'Keeping up with deadlines and requirements' },
  { value: 'idea_to_plan', label: 'Turning my business idea into a workable plan' },
  {
    value: 'several_challenges',
    label: "I have several challenges and don't know where to start",
  },
  { value: 'other', label: 'Other' },
] as const satisfies readonly Option<BiggestChallenge>[];

/** Every stored challenge value, including the retired one, for admin display and filters. */
export const ALL_CHALLENGE_OPTIONS = [
  ...CHALLENGE_OPTIONS,
  { value: 'managing_business', label: 'Managing my business (earlier questionnaire)' },
] as const satisfies readonly Option<BiggestChallenge>[];

/** Q7 — Which stage best describes your business? (kept from the first questionnaire) */
export const BUSINESS_STAGE_OPTIONS = [
  { value: 'just_exploring', label: 'Just exploring' },
  { value: 'planning_to_start', label: 'Planning to start' },
  { value: 'trying_to_register', label: 'Trying to register' },
  { value: 'already_operating', label: 'Already operating' },
] as const satisfies readonly Option<BusinessStage>[];

/** Q8 — early access. Short labels are what the admin views show. */
export const TESTING_INTEREST_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_right_now', label: 'Not right now' },
] as const satisfies readonly Option<TestingInterest>[];

/** Q8 wording as the visitor sees it. */
export const EARLY_ACCESS_QUESTION_OPTIONS = [
  { value: 'yes', label: "Yes, I'd love to try it" },
  { value: 'maybe', label: "Maybe — I'd like to learn more first" },
  { value: 'not_right_now', label: 'Not right now' },
] as const satisfies readonly Option<TestingInterest>[];

/** Q9 — willingness to share feedback. Same stored values as Q8. */
export const FEEDBACK_INTEREST_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_right_now', label: 'Not right now' },
] as const satisfies readonly Option<TestingInterest>[];

export const RECRUITMENT_STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'tested', label: 'Tested' },
] as const satisfies readonly Option<RecruitmentStatus>[];

/** Value tuples straight from the database enums, for `z.enum`. */
export const BUSINESS_STAGES = Constants.public.Enums.waitlist_business_stage;
export const BUSINESS_JOURNEYS = Constants.public.Enums.waitlist_business_journey;
export const INDUSTRIES = Constants.public.Enums.waitlist_industry;
export const PRIMARY_GOALS = Constants.public.Enums.waitlist_primary_goal;
export const CHALLENGES = Constants.public.Enums.waitlist_challenge;
export const TESTING_INTERESTS = Constants.public.Enums.waitlist_testing_interest;
export const RECRUITMENT_STATUSES = Constants.public.Enums.waitlist_recruitment_status;

/** Challenge values a visitor may choose today (the retired one is excluded). */
export const OFFERED_CHALLENGES = CHALLENGE_OPTIONS.map((o) => o.value) as [
  BiggestChallenge,
  ...BiggestChallenge[],
];

function labelFrom<T extends string>(options: readonly Option<T>[], value: T | null): string {
  if (value === null) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

export const businessStageLabel = (v: BusinessStage | null) => labelFrom(BUSINESS_STAGE_OPTIONS, v);
export const businessJourneyLabel = (v: BusinessJourney | null) =>
  labelFrom(BUSINESS_JOURNEY_OPTIONS, v);
export const industryLabel = (v: Industry | null) => labelFrom(INDUSTRY_OPTIONS, v);
export const primaryGoalLabel = (v: PrimaryGoal | null) => labelFrom(PRIMARY_GOAL_OPTIONS, v);
export const challengeLabel = (v: BiggestChallenge | null) => labelFrom(ALL_CHALLENGE_OPTIONS, v);
export const testingInterestLabel = (v: TestingInterest | null) =>
  labelFrom(TESTING_INTEREST_OPTIONS, v);
export const recruitmentStatusLabel = (v: RecruitmentStatus | null) =>
  labelFrom(RECRUITMENT_STATUS_OPTIONS, v);

/**
 * Answers that stand alone in a multi-select question: choosing one clears the
 * others, and choosing another clears it. The database enforces the same rule.
 */
export const EXCLUSIVE_GOAL = 'not_sure_yet' as const satisfies PrimaryGoal;
export const EXCLUSIVE_CHALLENGE = 'several_challenges' as const satisfies BiggestChallenge;

/** Limits shared by the form (maxLength), the schema and the database checks. */
export const SURVEY_LIMITS = {
  country: 100,
  cityIsland: 100,
  businessName: 200,
  industryOther: 100,
  goalOther: 300,
  challengeOther: 300,
  additionalInfo: 1000,
  recruitmentNotes: 2000,
  feedbackSummary: 2000,
  feedbackLink: 500,
} as const;
