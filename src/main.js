import Vue from 'vue'
import App from './App.vue'
import store from './store'
import './assets/rpg-awesome-icons.css'

Vue.config.productionTip = false

new Vue({
  store,
  render: (h) => h(App),
}).$mount('#app')

document.title =
  process.env.NODE_ENV === 'production' ? 'DND Tools' : '(Dev) DND Tools'
