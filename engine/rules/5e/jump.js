// Jump distances (PHB "Jumping", ch. 8). Strength-based, not speed-based.
// Pure and dependency-free.
//
//   Long jump: STR score feet with a 10 ft running start, half that standing.
//   High jump: 3 + STR modifier feet with a running start, half standing.
// (Each foot of jump costs a foot of movement; this only gives the distance.)

const abilityMod = (score) => Math.floor((score - 10) / 2)

function longJumpFeet(strScore, { running = true } = {}) {
  return running ? strScore : Math.floor(strScore / 2)
}

function highJumpFeet(strScore, { running = true } = {}) {
  const feet = Math.max(0, 3 + abilityMod(strScore))
  return running ? feet : Math.floor(feet / 2)
}

module.exports = { longJumpFeet, highJumpFeet }
