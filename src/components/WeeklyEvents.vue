<template>
  <div class="we-root">
    <div class="we-header">
      <div>
        <div class="we-title">Weekly Resolution</div>
        <div class="we-subtitle">Income · Refugees · Events</div>
        <div v-if="resolvedThrough != null" class="we-through">
          Resolved through
          <strong>{{ dayLabel(resolvedThrough) }}</strong>
        </div>
        <div v-if="nextWeekEndDay != null" class="we-through">
          {{
            results && !results.applied
              ? 'This roll covers'
              : 'Next roll covers'
          }}
          the week ending <strong>{{ dayLabel(nextWeekEndDay) }}</strong>
        </div>
      </div>
      <button class="we-roll-btn" @click="rollWeek">
        {{
          !results
            ? 'Roll Week'
            : results.applied
            ? 'Roll Next Week'
            : 'Re-roll Week'
        }}
      </button>
    </div>

    <div v-if="!results" class="we-empty">
      Click <strong>Roll Week</strong> to resolve this week's income, refugees
      arriving at Revivify, and any scheduled events.
    </div>

    <div v-else class="we-body">
      <!-- ── Income ── -->
      <div class="we-section">
        <div class="we-section-title">Income</div>
        <div v-for="item in results.income" :key="item.source" class="we-row">
          <span class="we-row-name">{{ item.source }}</span>
          <span v-if="item.amount_min !== item.amount_max" class="we-row-range"
            >{{ item.amount_min.toLocaleString() }}–{{
              item.amount_max.toLocaleString()
            }}</span
          >
          <span class="we-row-amount we-amount--income"
            >+{{ item.rolled.toLocaleString() }} gp</span
          >
        </div>
        <div class="we-section-total">
          <span>Weekly total</span>
          <span class="we-total-amount we-amount--income"
            >{{ results.totalIncome.toLocaleString() }} gp</span
          >
        </div>
      </div>

      <!-- ── Expenses ── -->
      <div class="we-section">
        <div class="we-section-title">Expenses</div>
        <div v-for="item in results.expenses" :key="item.name" class="we-row">
          <span class="we-row-name">{{ item.name }}</span>
          <span v-if="item.amount_min !== item.amount_max" class="we-row-range"
            >{{ item.amount_min.toLocaleString() }}–{{
              item.amount_max.toLocaleString()
            }}</span
          >
          <span class="we-row-amount we-amount--expense"
            >−{{ item.rolled.toLocaleString() }} gp</span
          >
        </div>
        <div v-if="monthlyExpenses.length" class="we-monthly-note">
          <span class="we-monthly-label">Monthly (not counted this week):</span>
          <span
            v-for="item in monthlyExpenses"
            :key="item.name"
            class="we-monthly-item"
          >
            {{ item.name }} ({{ item.amount_min }}–{{ item.amount_max }} gp/mo)
          </span>
        </div>
        <div class="we-section-total">
          <span>Weekly total</span>
          <span class="we-total-amount we-amount--expense"
            >{{ results.totalExpenses.toLocaleString() }} gp</span
          >
        </div>
      </div>

      <!-- ── Crossing Profit System ── -->
      <div v-if="results.crossingProfit" class="we-section">
        <div class="we-section-title">
          Crossing Profit System
          <span class="we-section-dice">1d20/week</span>
        </div>
        <div class="we-row">
          <span
            class="we-d20"
            :class="`we-cps-${
              results.crossingProfit.week1.band === 'Disaster' ? 'bad' : 'ok'
            }`"
            >{{ results.crossingProfit.week1.roll }}</span
          >
          <span class="we-row-name"
            >Week 1: {{ results.crossingProfit.week1.band }} —
            {{ results.crossingProfit.week1.detail }}</span
          >
          <span
            class="we-row-amount"
            :class="
              results.crossingProfit.week1.value >= 0
                ? 'we-amount--income'
                : 'we-amount--expense'
            "
            >{{ results.crossingProfit.week1.value >= 0 ? '+' : ''
            }}{{ results.crossingProfit.week1.value.toLocaleString() }} gp</span
          >
        </div>
        <template v-if="results.crossingProfit.stage === 'pending'">
          <div class="we-cps-note">
            Week 1 of 2 rolled — carried forward, no payout until next week's
            roll combines with this one.
          </div>
        </template>
        <template v-else>
          <div class="we-row">
            <span
              class="we-d20"
              :class="`we-cps-${
                results.crossingProfit.week2.band === 'Disaster' ? 'bad' : 'ok'
              }`"
              >{{ results.crossingProfit.week2.roll }}</span
            >
            <span class="we-row-name"
              >Week 2: {{ results.crossingProfit.week2.band }} —
              {{ results.crossingProfit.week2.detail }}</span
            >
            <span
              class="we-row-amount"
              :class="
                results.crossingProfit.week2.value >= 0
                  ? 'we-amount--income'
                  : 'we-amount--expense'
              "
              >{{ results.crossingProfit.week2.value >= 0 ? '+' : ''
              }}{{
                results.crossingProfit.week2.value.toLocaleString()
              }}
              gp</span
            >
          </div>
          <div class="we-section-total">
            <span
              >Combined 2-week payout ({{
                crossingShips.map((s) => s.name).join(', ')
              }})</span
            >
            <span
              class="we-total-amount"
              :class="
                results.crossingProfit.combined >= 0
                  ? 'we-amount--income'
                  : 'we-amount--expense'
              "
              >{{ results.crossingProfit.combined >= 0 ? '+' : ''
              }}{{ results.crossingProfit.combined.toLocaleString() }} gp</span
            >
          </div>
          <div class="we-cps-note">
            This payout is included in the week total below.
          </div>
        </template>
      </div>

      <!-- ── Week total ── -->
      <div
        class="we-net"
        :class="results.week.total >= 0 ? 'we-net--pos' : 'we-net--neg'"
      >
        <div class="we-net-main">
          <span class="we-net-label"
            >Total for the week ending
            {{
              results.weekEnd != null ? dayLabel(results.weekEnd) : 'this week'
            }}</span
          >
          <span class="we-net-amount"
            >{{ results.week.total >= 0 ? '+' : ''
            }}{{ results.week.total.toLocaleString() }} gp</span
          >
        </div>
        <div
          v-for="line in results.week.breakdown"
          :key="line.label"
          class="we-net-line"
        >
          <span>{{ line.label }}</span>
          <span
            >{{ line.amount >= 0 ? '+' : '−'
            }}{{ Math.abs(line.amount).toLocaleString() }} gp</span
          >
        </div>
        <div
          v-if="results.crossingProfit && !results.week.crossingPayout"
          class="we-net-line"
        >
          <span>Crossing Profit</span>
          <span>pays next week</span>
        </div>
        <div class="we-net-actions">
          <span v-if="results.applied" class="we-cps-note"
            >Applied. The party purse now holds
            {{ purseGold.toLocaleString() }} gp.</span
          >
          <template v-else>
            <span class="we-cps-note"
              >Not yet in the party purse ({{ purseGold.toLocaleString() }} gp
              now). Applying also marks this week as resolved.</span
            >
            <button class="we-cps-apply-btn" @click="applyWeek">
              Apply to Party Purse
            </button>
          </template>
        </div>
      </div>

      <!-- ── Revivify refugees ── -->
      <div class="we-section">
        <div class="we-section-title">
          Revivify — {{ results.refugees.count }} refugee{{
            results.refugees.count !== 1 ? 's' : ''
          }}
          arriving this week
          <span class="we-section-dice">1d4+3</span>
        </div>
        <div
          v-for="(r, i) in results.refugees.rolls"
          :key="i"
          class="we-row we-refugee-row"
        >
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
import {
  describeGameDate,
  nextWeekEnd,
  weekEndOnOrAfter,
} from '@/utils/calendar_utils'
import {
  refugeeTier,
  rollRefugees,
  rollLineItems,
  advanceCrossingProfit,
  weekTotal,
} from '@/utils/weeklyEvents'

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
      return (this.finances.income || []).filter(
        (i) => i.frequency === 'weekly'
      )
    },

    weeklyExpenses() {
      return (this.finances.expenses || []).filter(
        (e) => e.frequency === 'weekly'
      )
    },

    monthlyExpenses() {
      return (this.finances.expenses || []).filter(
        (e) => e.frequency === 'monthly'
      )
    },

    weeklyEvents() {
      return eventsData.weekly || []
    },

    crossingShips() {
      return (this.$store.state.assets || []).filter(
        (a) =>
          a.type === 'ship' &&
          (a.current_location || '').includes('Crossing Profit System')
      )
    },

    // The tool's one marker: the last week-end it applied. The next roll
    // covers the week ending after it. With no marker yet, fall back to the
    // end of the week the active party is in.
    resolvedThrough() {
      return this.finances.weekly_resolution?.resolved_through ?? null
    },

    nextWeekEndDay() {
      if (this.resolvedThrough != null) return nextWeekEnd(this.resolvedThrough)
      const day = this.$store.getters.activeParty?.game_day
      return day != null ? weekEndOnOrAfter(day) : null
    },

    purseGold() {
      return this.finances.party_purse?.gold ?? 0
    },

    crossingProfitPending() {
      return this.finances.crossing_profit?.pending ?? null
    },

    crossingProfitAwaiting() {
      return this.finances.crossing_profit?.awaiting_application ?? null
    },
  },

  methods: {
    dayLabel(dayCount) {
      const d = describeGameDate(dayCount)
      return `Year ${d.year}, day ${d.day_of_year} (${
        d.festival ? 'Festival' : 'Week ' + d.week
      })`
    },

    rollCrossingProfit() {
      // The two-week cycle (week 1 carried forward, week 2 combined, never
      // overwriting an unapplied payout) is engine/rules/weeklyEvents.js's
      // advanceCrossingProfit — this just persists what it says changed.
      // Applying to the party purse is a separate, deliberate action
      // (applyWeek below).
      const { next, rolled, ...display } = advanceCrossingProfit({
        pending: this.crossingProfitPending,
        awaiting: this.crossingProfitAwaiting,
      })
      if (rolled) {
        this.$store.commit('SET_CROSSING_PROFIT_PENDING', next.pending)
        if (next.awaiting) {
          this.$store.commit('SET_CROSSING_PROFIT_AWAITING', next.awaiting)
        }
      }
      return display
    },

    // One deliberate action moves the whole week into the purse: income,
    // expenses and, in the week it pays, the Crossing Profit payout (which
    // is then no longer awaiting). Guarded so a double click can't pay twice.
    applyWeek() {
      if (!this.results || this.results.applied) return
      this.$store.commit('ADJUST_PARTY_GOLD', this.results.week.total)
      if (this.results.crossingProfit?.stage === 'awaiting') {
        this.$store.commit('SET_CROSSING_PROFIT_AWAITING', null)
      }
      if (this.results.weekEnd != null) {
        this.$store.commit('SET_WEEKS_RESOLVED_THROUGH', this.results.weekEnd)
      }
      this.results.applied = true
    },

    rollWeek() {
      const { items: income, total: totalIncome } = rollLineItems(
        this.weeklyIncome
      )
      const { items: expenses, total: totalExpenses } = rollLineItems(
        this.weeklyExpenses
      )
      const refugees = rollRefugees()

      // Only running if at least one ship is currently tagged as on the
      // route (see assets.json) — stopping the activity is just removing
      // that tag from the ships, not a separate toggle. Re-rolling a week
      // that hasn't been applied yet keeps its Crossing Profit result:
      // rolling it again would advance the two-week cycle by a week.
      const keepCrossing =
        this.results && !this.results.applied && this.results.crossingProfit
      const crossingProfit = this.crossingShips.length
        ? keepCrossing || this.rollCrossingProfit()
        : null

      this.results = {
        income,
        expenses,
        totalIncome,
        totalExpenses,
        week: weekTotal({ totalIncome, totalExpenses, crossingProfit }),
        refugees,
        crossingProfit,
        weekEnd: this.nextWeekEndDay,
        applied: false,
      }
    },

    d20Class(roll) {
      const tier = refugeeTier(roll)
      return tier ? `tier-${tier.id}` : ''
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

.we-through {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 4px;
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
.we-roll-btn:hover {
  background: var(--color-accent-strong);
}

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
.we-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

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

.we-amount--income {
  color: #5a9e5a;
}
.we-amount--expense {
  color: #c0442a;
}

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
.we-monthly-label {
  color: var(--color-text-muted);
  font-style: normal;
}
.we-monthly-item {
  white-space: nowrap;
}

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
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid;
}
.we-net--pos {
  border-color: #5a9e5a;
  background: rgba(90, 158, 90, 0.1);
}
.we-net--neg {
  border-color: #c0442a;
  background: rgba(192, 68, 42, 0.1);
}

.we-net-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.we-net-line {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.we-net-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.3rem;
}

.we-net-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.we-net-amount {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 700;
}
.we-net--pos .we-net-amount {
  color: #5a9e5a;
}
.we-net--neg .we-net-amount {
  color: #c0442a;
}

/* ── Refugees ── */
.we-refugee-row {
  gap: 0.6rem;
}

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

.tier-critical {
  border-color: #8b1a1a;
  color: #c84444;
  background: rgba(139, 26, 26, 0.15);
}
.tier-standard {
  border-color: var(--color-border);
  color: var(--color-text-muted);
  background: transparent;
}
.tier-interesting {
  border-color: #336699;
  color: #5588cc;
  background: rgba(51, 102, 153, 0.12);
}
.tier-remarkable {
  border-color: #6644aa;
  color: #9966dd;
  background: rgba(102, 68, 170, 0.12);
}
.tier-extraordinary {
  border-color: #997722;
  color: #ccaa44;
  background: rgba(153, 119, 34, 0.12);
}
.tier-exceptional {
  border-color: var(--color-accent);
  color: var(--color-accent-strong);
  background: rgba(200, 169, 110, 0.15);
}

/* ── Crossing Profit System ── */
.we-cps-ok {
  border-color: var(--color-border);
  color: var(--color-text-muted);
  background: transparent;
}
.we-cps-bad {
  border-color: #8b1a1a;
  color: #c84444;
  background: rgba(139, 26, 26, 0.15);
}
.we-cps-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.25rem;
}

.we-cps-apply-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem;
}

.we-cps-apply-btn {
  padding: 0.3rem 0.9rem;
  background: var(--color-accent);
  border: none;
  border-radius: 5px;
  color: #1a1610;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.we-cps-apply-btn:hover {
  background: var(--color-accent-strong);
}

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
