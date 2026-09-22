export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [true, { ignoreAtRules: ["apply", "custom-variant", "theme"] }],
    "at-rule-prelude-no-invalid": [true, { ignoreAtRules: ["apply"] }],
    "custom-property-pattern": null,
    "selector-class-pattern": null,
  },
}
