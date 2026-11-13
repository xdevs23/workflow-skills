---
name: ux-design
description: Behavior of screen for user, such as input, place of parts, saving, state, errors and text on product screen
---

- In user interface, show error only on part that fails. Loading state gets loading indicator
- During save: show progress. Disable every control that could send save again
- Save edited field when it loses focus
- Never add save button to form
- Save field also after pause in input, where that serves reader better than focus loss
- Show progress of field save on that field. Disable no control during it
- Leave view as it was when optional feature cannot apply
- Give centre and most room of app screen to part where users of such apps spend most time. Put
  part used in passing into bar at edge of screen. On phone, open full screen view of that part
  only when reader asks for it
- Open item that carries much detail when reader clicks or taps it in list: in sidebar on wide
  screen, in dialog on tablet, on phone as full screen view with close button at top right, where
  apps put back button. Show content small enough for little space in bottom sheet. Expand row in
  place only for item with few details
- Make product screen self-evident through labels, controls, layout. Never put text explaining
  the product
- When part needs such text because behavior not evident: change the part, e.g. label, grouping,
  control
- Word state of data or action of reader by what happened and what reader can do next. Include
  where to check on work later
- Write string shown on product screen as label, action or state on which reader acts
- Label button with verb and object that say what button does, in plain words of its domain. Never
  invent own term for action. Never use word that reads as noun and as verb
- Give part heading only where heading tells reader something screen does not show
- Give every list limited to range of time or place a control that changes that range

## Choices

- Let reader choose outcome that reader wants, in reader's terms. Never ask reader to choose step
  of business behind it

## App screens

- Build app screen on layout known from apps of same kind: lists, detail, toolbar, tabs and main
  action where users of such apps look for them
- Draw phone app as app of its platform: app bar with title and actions at top, tab bar at
  bottom, controls of platform. Never as web page set to phone width
- Draw app alone. Never draw status bar, system bars, frame of device or other part of operating
  system around it
- At every width, lay out app screen as apps of its kind do at that width. Never stretch phone
  layout across wide window
- Align every part of app screen to one grid. Keep fields of one task together, in order of task
- Put every action on one object into one bar next to that object
- Offer every view and action on data that users of apps of same kind expect: switch between views
  of different range, create by hand, edit, move, delete
- Show picture beside each item that reader picks by look, e.g. dish, drink or product, so reader
  finds it at a glance. Never list such items as text alone
- Show at once only parts and controls needed by main task of screen. Keep every other view and
  action one step away, on item or part on which it acts, opened when reader asks for it
- Allow every change of item that can happen in reality, in every state of item. Block change only
  where reality cannot make it
- Open detail of status mark in place, beside item to which mark belongs. Never send reader to other
  view where item from which reader came is gone
- Let back, in app and in browser, take reader where reader came from: mostly up to view from
  which current view was opened, after jump from deep view into other branch of app back to view
  where jump started. Never replay views visited back and forth in reverse
- Link two views of same content both ways: input in either moves the other, e.g. click in
  transcript moves playhead and playhead scrolls transcript. Give link control that unlinks views
- Show data about a person that others nearby must not read, e.g. address, balance or amount owed
  between people, at size of body text. Give screen with such data one control, e.g. eye icon,
  that hides it at once
- Let each list of app screen scroll inside its own pane. Keep screen itself still, so detail
  opened from item far down list shows beside that item

## Order

- Show short fact repeated across items as icon, with its text as accessible name. Where room
  allows, write its meaning in one or two words beside icon. Never leave meaning only in text on
  hover
- Draw control as icon wherever known icon shows its action. Give it accessible name and text on
  hover. Never write label on it

## Motion and input

- Where picture shows parts that move in real life, let reader move every one of them by pointer,
  touch and keyboard
- Show how object is handled by object itself: let part to grab move slightly on hover and focus.
  Never write instruction for it
- Let reader set part that spins or slides in reality in motion by fling. Start it at rest. Keep
  force of fling as momentum and let it run down as on real thing
- Make interactive object behave as object imitated by it, for every input it takes. Before showing
  page, try each input in browser and compare result with real object
- Make every control work by keyboard, with touch target of at least 44 px and accessible name
- Close menu or dropdown on press of control that opened it
- Leave scrolling, zoom, trackpad, touch and keyboard native
