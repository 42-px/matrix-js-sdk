"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FilterComponent = void 0;

/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @module filter-component
 */

/**
 * Checks if a value matches a given field value, which may be a * terminated
 * wildcard pattern.
 * @param {String} actualValue  The value to be compared
 * @param {String} filterValue  The filter pattern to be compared
 * @return {boolean} true if the actualValue matches the filterValue
 */
function matchesWildcard(actualValue, filterValue) {
  if (filterValue.endsWith("*")) {
    const typePrefix = filterValue.slice(0, -1);
    return actualValue.substr(0, typePrefix.length) === typePrefix;
  } else {
    return actualValue === filterValue;
  }
}
/* eslint-disable camelcase */


/* eslint-enable camelcase */

/**
 * FilterComponent is a section of a Filter definition which defines the
 * types, rooms, senders filters etc to be applied to a particular type of resource.
 * This is all ported over from synapse's Filter object.
 *
 * N.B. that synapse refers to these as 'Filters', and what js-sdk refers to as
 * 'Filters' are referred to as 'FilterCollections'.
 *
 * @constructor
 * @param {Object} filterJson the definition of this filter JSON, e.g. { 'contains_url': true }
 */
class FilterComponent {
  constructor(filterJson) {
    this.filterJson = filterJson;
  }
  /**
   * Checks with the filter component matches the given event
   * @param {MatrixEvent} event event to be checked against the filter
   * @return {boolean} true if the event matches the filter
   */


  check(event) {
    return this.checkFields(event.getRoomId(), event.getSender(), event.getType(), event.getContent() ? event.getContent().url !== undefined : false);
  }
  /**
   * Converts the filter component into the form expected over the wire
   */


  toJSON() {
    return {
      types: this.filterJson.types || null,
      not_types: this.filterJson.not_types || [],
      rooms: this.filterJson.rooms || null,
      not_rooms: this.filterJson.not_rooms || [],
      senders: this.filterJson.senders || null,
      not_senders: this.filterJson.not_senders || [],
      contains_url: this.filterJson.contains_url || null
    };
  }
  /**
   * Checks whether the filter component matches the given event fields.
   * @param {String} roomId        the roomId for the event being checked
   * @param {String} sender        the sender of the event being checked
   * @param {String} eventType     the type of the event being checked
   * @param {boolean} containsUrl  whether the event contains a content.url field
   * @return {boolean} true if the event fields match the filter
   */


  checkFields(roomId, sender, eventType, containsUrl) {
    const literalKeys = {
      "rooms": function (v) {
        return roomId === v;
      },
      "senders": function (v) {
        return sender === v;
      },
      "types": function (v) {
        return matchesWildcard(eventType, v);
      }
    };

    for (let n = 0; n < Object.keys(literalKeys).length; n++) {
      const name = Object.keys(literalKeys)[n];
      const matchFunc = literalKeys[name];
      const notName = "not_" + name;
      const disallowedValues = this.filterJson[notName];

      if (disallowedValues !== null && disallowedValues !== void 0 && disallowedValues.some(matchFunc)) {
        return false;
      }

      const allowedValues = this.filterJson[name];

      if (allowedValues && !allowedValues.some(matchFunc)) {
        return false;
      }
    }

    const containsUrlFilter = this.filterJson.contains_url;

    if (containsUrlFilter !== undefined && containsUrlFilter !== containsUrl) {
      return false;
    }

    return true;
  }
  /**
   * Filters a list of events down to those which match this filter component
   * @param {MatrixEvent[]} events  Events to be checked against the filter component
   * @return {MatrixEvent[]} events which matched the filter component
   */


  filter(events) {
    return events.filter(this.check, this);
  }
  /**
   * Returns the limit field for a given filter component, providing a default of
   * 10 if none is otherwise specified. Cargo-culted from Synapse.
   * @return {Number} the limit for this filter component.
   */


  limit() {
    return this.filterJson.limit !== undefined ? this.filterJson.limit : 10;
  }

}

exports.FilterComponent = FilterComponent;