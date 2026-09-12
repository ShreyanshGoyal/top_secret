/** Strict JSON schema for structured output. It mirrors InterpretationSchema exactly;
 * the response is still validated locally, because a provider guarantee is not our guarantee.
 */
export const INTERPRETATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['disposition', 'intent', 'sourceMessageIds', 'question', 'explanation', 'pullRequestUrl', 'expectedDecisionVersion'],
  properties: {
    disposition: {
      type: 'string',
      enum: ['irrelevant', 'clarify', 'propose', 'confirm', 'tentative', 'withdraw', 'verify_pr', 'status'],
      description: 'What this thread is doing right now. Proposing is not confirming.',
    },
    intent: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['scope', 'retentionDays', 'appliesTo', 'effective'],
          properties: {
            scope: {
              type: 'object',
              additionalProperties: false,
              required: ['plans', 'organizationTypes', 'universityVerified'],
              properties: {
                plans: { type: 'array', items: { type: 'string', enum: ['free', 'paid'] } },
                organizationTypes: { type: 'array', items: { type: 'string', enum: ['university', 'company', 'personal'] } },
                universityVerified: { type: 'array', items: { type: 'boolean' } },
              },
            },
            retentionDays: { type: 'integer' },
            appliesTo: { type: 'string', enum: ['currently_stored_records'] },
            effective: { type: 'string', enum: ['immediate'] },
          },
        },
      ],
    },
    sourceMessageIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only ids that were supplied to you.',
    },
    question: { type: ['string', 'null'] },
    explanation: { type: 'string', description: 'One or two sentences of rationale. Not hidden reasoning.' },
    pullRequestUrl: { type: ['string', 'null'] },
    expectedDecisionVersion: { type: ['integer', 'null'] },
  },
} as const;
