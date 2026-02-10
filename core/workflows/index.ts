/**
 * Workflows Module
 *
 * Onboarding wizard + outcome recording/analysis/learning.
 */

export { OnboardingWizard, type WizardResult } from './onboarding'
export { default as outcomeAnalyzer, OutcomeAnalyzer } from './outcome-analyzer'
export type { ExtractedPattern, LearningResult, PatternCategory } from './outcome-learner'
export { default as outcomeMemoryLearner, OutcomeMemoryLearner } from './outcome-learner'
export { default as outcomeRecorder, OutcomeRecorder } from './outcome-recorder'
export { default as outcomeStorage, OutcomeStorage } from './outcome-storage'
