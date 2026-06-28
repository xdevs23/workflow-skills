import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { connect } from "./lib/connection"
import AppLayout from "./layouts/app"
import Empty from "./pages/empty"
import GroupThread from "./pages/group-thread"
import DmThread from "./pages/dm-thread"
import GroupMembers from "./pages/group-members"
import IdentityDetail from "./pages/identity-detail"
import "./index.css"

// Open the hub connection once at boot: hello → admin_subscribe → snapshot → live
// tail, all feeding the single store the UI renders off.
connect()

render(
  () => (
    <Router root={AppLayout}>
      <Route path="/" component={Empty} />
      <Route path="/g/:name" component={GroupThread} />
      <Route path="/g/:name/members" component={GroupMembers} />
      <Route path="/dm/:id" component={DmThread} />
      <Route path="/i/:id" component={IdentityDetail} />
    </Router>
  ),
  document.getElementById("root")!,
)
