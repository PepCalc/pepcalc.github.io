# Components and views

Part of the `front-end` skill.

## Shared components

| Component                                       | Use                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `common/PresetPicker.vue`                       | Number input as preset chips plus a Custom field; chips are buttons with `aria-pressed`       |
| `common/SourceBadge.vue`                        | Shows where a number came from (label, trial, community, ...)                                 |
| `common/AppSnackbar.vue`, `AppConfirm.vue`      | Render the notify and confirm stores; mounted once in `App.vue`                               |
| `common/UpdatePrompt.vue`                       | Service-worker update and offline-ready notices                                               |
| `common/DisclaimerDialog.vue`                   | First-run research-use acknowledgement                                                        |
| `calculator/SyringeGraphic.vue`                 | SVG syringe drawn from a `SyringeSpec`; accessible label states the reading                   |
| `calculator/DrawResult.vue`                     | Headline reading, warnings, syringe picker, readings on every syringe                         |
| `charts/PkPanel.vue`                            | Chooses catalog or user-supplied PK, shows sources and caveats, or why no curve exists        |
| `charts/PkChart.vue`                            | ECharts curve: logged doses (solid) and the previewed draw (dashed), "Now" marker, table view |
| `shelf/VialCard.vue`, `DrawList.vue`            | Shelf list and draw history                                                                   |
| `shelf/VialFormDialog.vue`, `LogDrawDialog.vue` | Edit a vial (composition, PK override), log a draw                                            |

## Patterns

- Dialogs reset their form from props each time they open, so abandoned edits never leak.
- A view that edits data calls a store action, then `notify.show()`.
- Every number with a source shows a `SourceBadge`; community-reported values never look like
  clinical ones.
- Loading a shelf vial into the calculator (`?vial=<id>`) locks amount and water; editing them
  happens on the vial page so history stays consistent.
