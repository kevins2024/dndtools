import Vue from 'vue'
import App from './App.vue'

Vue.config.productionTip = false

new Vue({
  render: (h) => h(App),
}).$mount('#app')

document.title =
  process.env.NODE_ENV === 'production' ? 'DND Tools' : '(Dev) DND Tools'
