<template>
  <div class="we-root">

    <div class="we-header">
      <div>
        <div class="we-title">Weekly Resolution</div>
        <div class="we-subtitle">Income · Refugees · Events</div>
      </div>
      <button class="we-roll-btn" @click="rollWeek">
        {{ results ? 'Re-roll Week' : 'Roll Week' }}
      </button>
    </div>

    <div v-if="!results" class="we-empty">
      Click <strong>Roll Week</strong> to resolve this week's income, refugees arriving at Revivify, and any scheduled events.
    </div>

    <div v-else class="we-body">

      <!-- ── Income ── -->
      <div class="we-section">
        <div class="we-section-title">Income</div>
        <div v-for="item in results.income" :key="item.source" class="we-row">
          <span class="we-row-name">{{ item.source }}</span>
          <span v-if="item.amount_min !== item.amount_max" class="we-row-range">{{ item.amount_min.toLocaleString() }}–{{ item.amount_max.toLocaleString() }}</span>
          <span class="we-row-amount we-amount--income">+{{ item.rolled.toLocaleString() }} gp</span>
        </div>
        <div class="we-section-total">
          <span>Weekly total</span>
          <span class="we-total-amount we-amount--income">{{ results.totalIncome.toLocaleString() }} gp</span>
        </div>
      </div>

      <!-- ── Expenses ── -->
      <div class="we-section">
        <div class="we-section-title">Expenses</div>
        <div v-for="item in results.expenses" :key="item.name" class="we-row">
          <span class="we-row-name">{{ item.name }}</span>
          <span v-if="item.amount_min !== item.amount_max" class="we-row-range">{{ item.amount_min.toLocaleString() }}–{{ item.amount_max.toLocaleString() }}</span>
          <span class="we-row-amount we-amount--expense">−{{ item.rolled.toLocaleString() }} gp</span>
        </div>
        <div v-if="monthlyExpenses.length" class="we-monthly-note">
          <span class="we-monthly-label">Monthly (not counted this week):</span>
          <span v-for="item in monthlyExpenses" :key="item.name" class="we-monthly-item">
            {{ item.name }} ({{ item.amount_min }}–{{ item.amount_max }} gp/mo)
          </span>
        </div>
        <div class="we-section-total">
          <span>Weekly total</span>
          <span class="we-total-amount we-amount--expense">{{ results.totalExpenses.toLocaleString() }} gp</span>
        </div>
      </div>

      <!-- ── Net ── -->
      <div class="we-net" :class="results.net >= 0 ? 'we-net--pos' : 'we-net--neg'">
        <span class="we-net-label">Net this week</span>
        <span class="we-net-amount">{{ results.net >= 0 ? '+' : '' }}{{ results.net.toLocaleString() }} gp</span>
      </div>

      <!-- ── Revivify refugees ── -->
      <div class="we-section">
        <div class="we-section-title">
          Revivify — {{ results.refugees.count }} refugee{{ results.refugees.count !== 1 ? 's' : '' }} arriving this week
          <span class="we-section-dice">1d4+3</span>
        </div>
        <div v-for="(r, i) in results.refugees.rolls" :key="i" class="we-row we-refugee-row">
          <span class="we-refugee-num">#{{ i + 1 }}</span>
          <span class="we-d20" :class="d20Class(r.roll)">{{ r.roll }}</span>
          <span class="we-refugee-label">{{ r.label }}</span>
        </div>
      </div>

      <!-- ── Events ── -->
      <div class="we-section">
        <div class="we-section-title">Events</div>
        <div v-if="weeklyEvents.length">
          <div v-for="ev in weeklyEvents" :key="ev.name" class="we-row">
            <span class="we-row-name">{{ ev.name }}</span>
            <span class="we-row-range">{{ ev.description }}</span>
          </div>
        </div>
        <div v-else class="we-no-events">No weekly events scheduled.</div>
      </div>

    </div>
  </div>
</template>

<script>
import eventsData from '@/data/events.json'

const REFUGEE_TIERS = [
  { max: 1,  label: 'Critically desperate — may need immediate intervention',  cls: 'tier-critical'     },
  { max: 5,  label: 'Standard — needs shelter, stability, and time',            cls: 'tier-standard'     },
  { max: 10, label: 'Interesting — notable skill or unusual background',        cls: 'tier-interesting'  },
  { max: 15, label: 'Remarkable — significant history or connections',          cls: 'tier-remarkable'   },
  { max: 19, label: 'Extraordinary — rare circumstances, clear story thread',   cls: 'tier-extraordinary'},
  { max: 20, label: 'Exceptional — major NPC potential, unique situation',      cls: 'tier-exceptional'  },
]

function rollBetween(min, max) {
  if (min === max) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}
function d4()  { return Math.floor(Math.random() * 4)  + 1 }
function d20() { return Math.floor(Math.random() * 20) + 1 }

export default {
  name: 'WeeklyEvents',

  data() {
    return {
      results: null,
    }
  },

  computed: {
    finances() {
      return this.$store.state.finances || {}
    },

    weeklyIncome() {
      return (this.finances.income || []).filter((i) => i.frequency === 'weekly')
    },

    weeklyExpenses() {
      return (this.finances.expenses || []).filter((e) => e.frequency === 'weekly')
    },

    monthlyExpenses() {
      return (this.finances.expenses || []).filter((e) => e.frequency === 'monthly')
    },

    weeklyEvents() {
      return eventsData.weekly || []
    },
  },

  methods: {
    rollWeek() {
      const income = this.weeklyIncome.map((item) => ({
        ...item,
        rolled: rollBetween(item.amount_min, item.amount_max),
      }))

      const expenses = this.weeklyExpenses.map((item) => ({
        ...item,
        rolled: rollBetween(item.amount_min, item.amount_max),
      }))

      const totalIncome   = income.reduce((s, i) => s + i.rolled, 0)
      const totalExpenses = expenses.reduce((s, i) => s + i.rolled, 0)

      const refugeeCount = d4() + 3
      const refugeeRolls = Array.from({ length: refugeeCount }, () => {
        const roll = d20()
        const tier = REFUGEE_TIERS.find((t) => roll <= t.max)
        return { roll, label: tier.label, cls: tier.cls }
      })

      this.results = {
        income,
        expenses,
        totalIncome,
        totalExpenses,
        net: totalIncome - totalExpenses,
        refugees: { count: refugeeCount, rolls: refugeeRolls },
      }
    },

    d20Class(roll) {
      return REFUGEE_TIERS.find((t) => roll <= t.max)?.cls ?? ''
    },
  },
}
</script>

<style scoped>
.we-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 1rem 1.25rem;
  gap: 1rem;
}

/* ── Header ── */
.we-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
}

.we-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-accent-strong);
}

.we-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  margin-top: 2px;
}

.we-roll-btn {
  padding: 0.4rem 1.1rem;
  background: var(--color-accent);
  border: none;
  border-radius: 5px;
  color: #1a1610;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.we-roll-btn:hover { background: var(--color-accent-strong); }

/* ── Empty state ── */
.we-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  font-style: italic;
  margin-top: 2rem;
  text-align: center;
}

/* ── Body ── */
.we-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
}

/* ── Sections ── */
.we-section {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.we-section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.2rem;
  margin-bottom: 0.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.we-section-dice {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0 5px;
  margin-left: auto;
}

/* ── Rows ── */
.we-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.15rem 0.25rem;
  border-radius: 3px;
  font-size: var(--font-size-base);
}
.we-row:hover { background: rgba(255,255,255,0.03); }

.we-row-name {
  flex: 1;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.we-row-range {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
}

.we-row-amount {
  font-weight: 600;
  white-space: nowrap;
  min-width: 90px;
  text-align: right;
}

.we-amount--income  { color: #5a9e5a; }
.we-amount--expense { color: #c0442a; }

/* ── Monthly note ── */
.we-monthly-note {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  padding: 0.2rem 0.25rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}
.we-monthly-label { color: var(--color-text-muted); font-style: normal; }
.we-monthly-item  { white-space: nowrap; }

/* ── Section total ── */
.we-section-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.25rem 0;
  border-top: 1px solid var(--color-border);
  margin-top: 0.15rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.we-total-amount {
  font-size: var(--font-size-base);
  font-weight: 600;
}

/* ── Net banner ── */
.we-net {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid;
}
.we-net--pos { border-color: #5a9e5a; background: rgba(90,158,90,0.1); }
.we-net--neg { border-color: #c0442a; background: rgba(192,68,42,0.1); }

.we-net-label  { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.we-net-amount {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 700;
}
.we-net--pos .we-net-amount { color: #5a9e5a; }
.we-net--neg .we-net-amount { color: #c0442a; }

/* ── Refugees ── */
.we-refugee-row { gap: 0.6rem; }

.we-refugee-num {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  min-width: 22px;
}

.we-d20 {
  min-width: 26px;
  height: 26px;
  border-radius: 4px;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  font-weight: 700;
  flex-shrink: 0;
}

.tier-critical      { border-color: #8b1a1a; color: #c84444; background: rgba(139,26,26,0.15); }
.tier-standard      { border-color: var(--color-border); color: var(--color-text-muted); background: transparent; }
.tier-interesting   { border-color: #336699; color: #5588cc; background: rgba(51,102,153,0.12); }
.tier-remarkable    { border-color: #6644aa; color: #9966dd; background: rgba(102,68,170,0.12); }
.tier-extraordinary { border-color: #997722; color: #ccaa44; background: rgba(153,119,34,0.12); }
.tier-exceptional   { border-color: var(--color-accent); color: var(--color-accent-strong); background: rgba(200,169,110,0.15); }

.we-refugee-label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  flex: 1;
}

/* ── Events ── */
.we-no-events {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.25rem;
}
</style>
