growMapJS
=========

Alternative Javascript frontend for the `growstuff.org` site. This JS app provides an alternative frontend for
the `growstuff.org` site that consists of only one map. The map is based on [leafletjs](http://leafletjs.com/),
[heatmapjs](http://www.patrick-wied.at/static/heatmapjs/), [markercluster](https://github.com/Leaflet/Leaflet.markercluster)
and [stamen maps](http://maps.stamen.com).
It provides an all-in-one map view with all the plantings for all the crops and a time-slider that allows to
limit the time range in which the plantings shown have been existing. The popups contain links back to the
`growstuff.org` site.

This frontend can be run anywhere using the `growstuff.org` JSON API, but it will be much faster when run together
with the [growMapAPI](https://github.com/balint42/growMapAPI) backend. See both together in action
[here](http://morvai.de/growmap/)!

Installation
------------

Grab all the files and open `index.html` in an editor. Modify the lines with `growMap.baseUrl` and `growMap.apiUrl`
to the correct urls (don't forget the trailing slashes!):

### with growMapAPI
The current settings should work as is, if you install this repos together with growMapAPI in a `/growmap` folder
on your server. Simply put the files of both repositories in the same `growmap` folder on your domain root.

### with growstuff.org API
If you plan to use the `growstuff.org` API directly without the growMapAPI then you will have to change
`growMap.apiUrl` to `growstuff.org` while the `growMap.baseUrl` always has to point to the directory with
`index.html`. Of course you can create your own `index.html` but don't forget to give credit to `growstuff.org`.

Usage
-----

Just try it! The slider on the lower left allows to limit the time range in which the plantings shown have been
existing. All data is provided by the [growstuff.org](http://growstuff.org/) site under the [CC-BY-SA](https://creativecommons.org/licenses/by-sa/3.0/) license.
