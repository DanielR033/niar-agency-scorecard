// Loads src/questions.json into indices used by scoring.js, tiering.js and divergence.js.
// This is the only module that reads the raw instrument shape — everything else
// consumes the indices below, never questions.json directly.

export function loadInstrument(raw) {
  const questionsById = new Map();
  const optionIndex = new Map(); // `${questionId}:${value}` -> option object
  const blockCQuestions = []; // [{ id, dimension }]

  for (const block of raw.blocks) {
    for (const question of block.questions) {
      questionsById.set(question.id, { ...question, blockId: block.id });

      if (Array.isArray(question.options)) {
        for (const option of question.options) {
          optionIndex.set(`${question.id}:${option.value}`, option);
        }
      }

      if (question.type === "scale_anchored") {
        blockCQuestions.push({ id: question.id, dimension: question.dimension });
      }
    }
  }

  const dimensionQuestionIds = new Map(); // dimensionId -> [questionId, ...]
  for (const { id, dimension } of blockCQuestions) {
    if (!dimensionQuestionIds.has(dimension)) dimensionQuestionIds.set(dimension, []);
    dimensionQuestionIds.get(dimension).push(id);
  }

  return {
    raw,
    dimensions: raw.dimensions,
    dimensionIds: raw.dimensions.map((d) => d.id),
    scoring: raw.scoring,
    derivations: raw.derivations,
    questionsById,
    optionIndex,
    blockCQuestions,
    dimensionQuestionIds,
  };
}

export function getOptionField(instrument, questionId, value, field) {
  const option = instrument.optionIndex.get(`${questionId}:${value}`);
  return option ? option[field] : undefined;
}

export function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
