const skills = require('../data/skills.json')

function listSkills() {
  return skills
}

function loadSkill(id) {
  return (
    skills.find(
      (s) => s.id === id || s.name.toLowerCase() === String(id).toLowerCase()
    ) || null
  )
}

module.exports = { listSkills, loadSkill }
