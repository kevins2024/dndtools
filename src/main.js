import Vue from 'vue'
import App from './App.vue'
import store from './store'
import { dnd } from './utils/dnd_utils'

Vue.config.productionTip = false
Vue.prototype.$dnd = dnd

new Vue({
  store,
  render: (h) => h(App),
}).$mount('#app')

document.title =
  process.env.NODE_ENV === 'production' ? 'DND Tools' : '(Dev) DND Tools'
