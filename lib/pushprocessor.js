"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PushProcessor = void 0;

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _utils = require("./utils");

var _logger = require("./logger");

var _PushRules = require("./@types/PushRules");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

/**
 * @module pushprocessor
 */
const RULEKINDS_IN_ORDER = [_PushRules.PushRuleKind.Override, _PushRules.PushRuleKind.ContentSpecific, _PushRules.PushRuleKind.RoomSpecific, _PushRules.PushRuleKind.SenderSpecific, _PushRules.PushRuleKind.Underride]; // The default override rules to apply to the push rules that arrive from the server.
// We do this for two reasons:
//   1. Synapse is unlikely to send us the push rule in an incremental sync - see
//      https://github.com/matrix-org/synapse/pull/4867#issuecomment-481446072 for
//      more details.
//   2. We often want to start using push rules ahead of the server supporting them,
//      and so we can put them here.

const DEFAULT_OVERRIDE_RULES = [{
  // For homeservers which don't support MSC1930 yet
  rule_id: ".m.rule.tombstone",
  default: true,
  enabled: true,
  conditions: [{
    kind: _PushRules.ConditionKind.EventMatch,
    key: "type",
    pattern: "m.room.tombstone"
  }, {
    kind: _PushRules.ConditionKind.EventMatch,
    key: "state_key",
    pattern: ""
  }],
  actions: [_PushRules.PushRuleActionName.Notify, {
    set_tweak: _PushRules.TweakName.Highlight,
    value: true
  }]
}, {
  // For homeservers which don't support MSC2153 yet
  rule_id: ".m.rule.reaction",
  default: true,
  enabled: true,
  conditions: [{
    kind: _PushRules.ConditionKind.EventMatch,
    key: "type",
    pattern: "m.reaction"
  }],
  actions: [_PushRules.PushRuleActionName.DontNotify]
}];

class PushProcessor {
  /**
   * Construct a Push Processor.
   * @constructor
   * @param {Object} client The Matrix client object to use
   */
  constructor(client) {
    this.client = client;
  }
  /**
   * Convert a list of actions into a object with the actions as keys and their values
   * eg. [ 'notify', { set_tweak: 'sound', value: 'default' } ]
   *     becomes { notify: true, tweaks: { sound: 'default' } }
   * @param {array} actionList The actions list
   *
   * @return {object} A object with key 'notify' (true or false) and an object of actions
   */


  static actionListToActionsObject(actionList) {
    const actionObj = {
      notify: false,
      tweaks: {}
    };

    for (let i = 0; i < actionList.length; ++i) {
      const action = actionList[i];

      if (action === _PushRules.PushRuleActionName.Notify) {
        actionObj.notify = true;
      } else if (typeof action === 'object') {
        if (action.value === undefined) {
          action.value = true;
        }

        actionObj.tweaks[action.set_tweak] = action.value;
      }
    }

    return actionObj;
  }
  /**
   * Rewrites conditions on a client's push rules to match the defaults
   * where applicable. Useful for upgrading push rules to more strict
   * conditions when the server is falling behind on defaults.
   * @param {object} incomingRules The client's existing push rules
   * @returns {object} The rewritten rules
   */


  static rewriteDefaultRules(incomingRules) {
    let newRules = JSON.parse(JSON.stringify(incomingRules)); // deep clone
    // These lines are mostly to make the tests happy. We shouldn't run into these
    // properties missing in practice.

    if (!newRules) newRules = {};
    if (!newRules.global) newRules.global = {};
    if (!newRules.global.override) newRules.global.override = []; // Merge the client-level defaults with the ones from the server

    const globalOverrides = newRules.global.override;

    for (const override of DEFAULT_OVERRIDE_RULES) {
      const existingRule = globalOverrides.find(r => r.rule_id === override.rule_id);

      if (existingRule) {
        // Copy over the actions, default, and conditions. Don't touch the user's
        // preference.
        existingRule.default = override.default;
        existingRule.conditions = override.conditions;
        existingRule.actions = override.actions;
      } else {
        // Add the rule
        const ruleId = override.rule_id;

        _logger.logger.warn(`Adding default global override for ${ruleId}`);

        globalOverrides.push(override);
      }
    }

    return newRules;
  }

  // $glob: RegExp
  matchingRuleFromKindSet(ev, kindset) {
    for (let ruleKindIndex = 0; ruleKindIndex < RULEKINDS_IN_ORDER.length; ++ruleKindIndex) {
      const kind = RULEKINDS_IN_ORDER[ruleKindIndex];
      const ruleset = kindset[kind];

      if (!ruleset) {
        continue;
      }

      for (let ruleIndex = 0; ruleIndex < ruleset.length; ++ruleIndex) {
        const rule = ruleset[ruleIndex];

        if (!rule.enabled) {
          continue;
        }

        const rawrule = this.templateRuleToRaw(kind, rule);

        if (!rawrule) {
          continue;
        }

        if (this.ruleMatchesEvent(rawrule, ev)) {
          return _objectSpread(_objectSpread({}, rule), {}, {
            kind
          });
        }
      }
    }

    return null;
  }

  templateRuleToRaw(kind, tprule) {
    const rawrule = {
      'rule_id': tprule.rule_id,
      'actions': tprule.actions,
      'conditions': []
    };

    switch (kind) {
      case _PushRules.PushRuleKind.Underride:
      case _PushRules.PushRuleKind.Override:
        rawrule.conditions = tprule.conditions;
        break;

      case _PushRules.PushRuleKind.RoomSpecific:
        if (!tprule.rule_id) {
          return null;
        }

        rawrule.conditions.push({
          'kind': _PushRules.ConditionKind.EventMatch,
          'key': 'room_id',
          'value': tprule.rule_id
        });
        break;

      case _PushRules.PushRuleKind.SenderSpecific:
        if (!tprule.rule_id) {
          return null;
        }

        rawrule.conditions.push({
          'kind': _PushRules.ConditionKind.EventMatch,
          'key': 'user_id',
          'value': tprule.rule_id
        });
        break;

      case _PushRules.PushRuleKind.ContentSpecific:
        if (!tprule.pattern) {
          return null;
        }

        rawrule.conditions.push({
          'kind': _PushRules.ConditionKind.EventMatch,
          'key': 'content.body',
          'pattern': tprule.pattern
        });
        break;
    }

    return rawrule;
  }

  eventFulfillsCondition(cond, ev) {
    switch (cond.kind) {
      case _PushRules.ConditionKind.EventMatch:
        return this.eventFulfillsEventMatchCondition(cond, ev);

      case _PushRules.ConditionKind.ContainsDisplayName:
        return this.eventFulfillsDisplayNameCondition(cond, ev);

      case _PushRules.ConditionKind.RoomMemberCount:
        return this.eventFulfillsRoomMemberCountCondition(cond, ev);

      case _PushRules.ConditionKind.SenderNotificationPermission:
        return this.eventFulfillsSenderNotifPermCondition(cond, ev);
    } // unknown conditions: we previously matched all unknown conditions,
    // but given that rules can be added to the base rules on a server,
    // it's probably better to not match unknown conditions.


    return false;
  }

  eventFulfillsSenderNotifPermCondition(cond, ev) {
    const notifLevelKey = cond['key'];

    if (!notifLevelKey) {
      return false;
    }

    const room = this.client.getRoom(ev.getRoomId());

    if (!(room !== null && room !== void 0 && room.currentState)) {
      return false;
    } // Note that this should not be the current state of the room but the state at
    // the point the event is in the DAG. Unfortunately the js-sdk does not store
    // this.


    return room.currentState.mayTriggerNotifOfType(notifLevelKey, ev.getSender());
  }

  eventFulfillsRoomMemberCountCondition(cond, ev) {
    if (!cond.is) {
      return false;
    }

    const room = this.client.getRoom(ev.getRoomId());

    if (!room || !room.currentState || !room.currentState.members) {
      return false;
    }

    const memberCount = room.currentState.getJoinedMemberCount();
    const m = cond.is.match(/^([=<>]*)([0-9]*)$/);

    if (!m) {
      return false;
    }

    const ineq = m[1];
    const rhs = parseInt(m[2]);

    if (isNaN(rhs)) {
      return false;
    }

    switch (ineq) {
      case '':
      case '==':
        return memberCount == rhs;

      case '<':
        return memberCount < rhs;

      case '>':
        return memberCount > rhs;

      case '<=':
        return memberCount <= rhs;

      case '>=':
        return memberCount >= rhs;

      default:
        return false;
    }
  }

  eventFulfillsDisplayNameCondition(cond, ev) {
    let content = ev.getContent();

    if (ev.isEncrypted() && ev.getClearContent()) {
      content = ev.getClearContent();
    }

    if (!content || !content.body || typeof content.body != 'string') {
      return false;
    }

    const room = this.client.getRoom(ev.getRoomId());

    if (!room || !room.currentState || !room.currentState.members || !room.currentState.getMember(this.client.credentials.userId)) {
      return false;
    }

    const displayName = room.currentState.getMember(this.client.credentials.userId).name; // N.B. we can't use \b as it chokes on unicode. however \W seems to be okay
    // as shorthand for [^0-9A-Za-z_].

    const pat = new RegExp("(^|\\W)" + (0, _utils.escapeRegExp)(displayName) + "(\\W|$)", 'i');
    return content.body.search(pat) > -1;
  }

  eventFulfillsEventMatchCondition(cond, ev) {
    if (!cond.key) {
      return false;
    }

    const val = this.valueForDottedKey(cond.key, ev);

    if (typeof val !== 'string') {
      return false;
    }

    if (cond.value) {
      return cond.value === val;
    }

    if (typeof cond.pattern !== 'string') {
      return false;
    }

    let regex;

    if (cond.key == 'content.body') {
      regex = this.createCachedRegex('(^|\\W)', cond.pattern, '(\\W|$)');
    } else {
      regex = this.createCachedRegex('^', cond.pattern, '$');
    }

    return !!val.match(regex);
  }

  createCachedRegex(prefix, glob, suffix) {
    if (PushProcessor.cachedGlobToRegex[glob]) {
      return PushProcessor.cachedGlobToRegex[glob];
    }

    PushProcessor.cachedGlobToRegex[glob] = new RegExp(prefix + (0, _utils.globToRegexp)(glob) + suffix, 'i');
    return PushProcessor.cachedGlobToRegex[glob];
  }

  valueForDottedKey(key, ev) {
    const parts = key.split('.');
    let val; // special-case the first component to deal with encrypted messages

    const firstPart = parts[0];

    if (firstPart === 'content') {
      val = ev.getContent();
      parts.shift();
    } else if (firstPart === 'type') {
      val = ev.getType();
      parts.shift();
    } else {
      // use the raw event for any other fields
      val = ev.event;
    }

    while (parts.length > 0) {
      const thisPart = parts.shift();

      if ((0, _utils.isNullOrUndefined)(val[thisPart])) {
        return null;
      }

      val = val[thisPart];
    }

    return val;
  }

  matchingRuleForEventWithRulesets(ev, rulesets) {
    if (!rulesets) {
      return null;
    }

    if (ev.getSender() === this.client.credentials.userId) {
      return null;
    }

    return this.matchingRuleFromKindSet(ev, rulesets.global);
  }

  pushActionsForEventAndRulesets(ev, rulesets) {
    const rule = this.matchingRuleForEventWithRulesets(ev, rulesets);

    if (!rule) {
      return {};
    }

    const actionObj = PushProcessor.actionListToActionsObject(rule.actions); // Some actions are implicit in some situations: we add those here

    if (actionObj.tweaks.highlight === undefined) {
      // if it isn't specified, highlight if it's a content
      // rule but otherwise not
      actionObj.tweaks.highlight = rule.kind == _PushRules.PushRuleKind.ContentSpecific;
    }

    return actionObj;
  }

  ruleMatchesEvent(rule, ev) {
    let ret = true;

    for (let i = 0; i < rule.conditions.length; ++i) {
      const cond = rule.conditions[i]; // @ts-ignore

      ret &= this.eventFulfillsCondition(cond, ev);
    } //console.log("Rule "+rule.rule_id+(ret ? " matches" : " doesn't match"));


    return ret;
  }
  /**
   * Get the user's push actions for the given event
   *
   * @param {module:models/event.MatrixEvent} ev
   *
   * @return {PushAction}
   */


  actionsForEvent(ev) {
    return this.pushActionsForEventAndRulesets(ev, this.client.pushRules);
  }
  /**
   * Get one of the users push rules by its ID
   *
   * @param {string} ruleId The ID of the rule to search for
   * @return {object} The push rule, or null if no such rule was found
   */


  getPushRuleById(ruleId) {
    for (const scope of ['global']) {
      if (this.client.pushRules[scope] === undefined) continue;

      for (const kind of RULEKINDS_IN_ORDER) {
        if (this.client.pushRules[scope][kind] === undefined) continue;

        for (const rule of this.client.pushRules[scope][kind]) {
          if (rule.rule_id === ruleId) return rule;
        }
      }
    }

    return null;
  }

}
/**
 * @typedef {Object} PushAction
 * @type {Object}
 * @property {boolean} notify Whether this event should notify the user or not.
 * @property {Object} tweaks How this event should be notified.
 * @property {boolean} tweaks.highlight Whether this event should be highlighted
 * on the UI.
 * @property {boolean} tweaks.sound Whether this notification should produce a
 * noise.
 */


exports.PushProcessor = PushProcessor;
(0, _defineProperty2.default)(PushProcessor, "cachedGlobToRegex", {});