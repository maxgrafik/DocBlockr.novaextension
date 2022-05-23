## Version 0.6.1

* Bugfix


## Version 0.6

* Added basic support for JSX/TSX files.
  Enabling JavaScript also enables it for JSX. Same for TypeScript/TSX.


## Version 0.5

* Comment extension _(experimental feature)_
  Pressing return inside a docblock will try to insert a leading asterisk and maintain indentation. This is very hacky code, which constantly tracks cursor position and docblock contents. This **may** slow down your editor, which is why this is an experimental feature and disabled by default. Can be enabled in global settings.
* minor fixes


## Version 0.4

* Custom tags for header blocks (global and per workspace)
* bug fixes


## Version 0.3

* Better handling of different line endings
* Completions now also provide a header block as first comment in a document
  Additional/default fields for this will be added in v0.4
* Added menu command to add docblocks
* Added menu command to (re-)format docblocks
  Wrap width is currently hard-coded to 80 characters
* more code cleanup


## Version 0.2

* Tag completions (@...)
* Reworked preferences handling
* Catching false positives
  Statements which look like functions to DocBlockr (if, for, switch, while)
* some code cleanup


## Version 0.1

First halfway decent working version
