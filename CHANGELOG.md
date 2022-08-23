## Version 0.9.0

* Added support for Swift *(experimental)*


## Version 0.8.0

* Added support for Java, ObjC/ObjC++ and Rust. *There may be issues!*
* v0.6.1 introduced new bugs, so I reviewed the whole code and found even more bugs and weird stuff some of which I for the life of me can't remember why I did.
* Additionally Nova’s indentation logic breaks DocBlockr in many cases, so I have also rewritten that part. Hoping this won’t introduce new bugs.


## Version 0.7.0

* Portuguese translation by [Gwyneth Llewelyn](https://github.com/GwynethLlewelyn)
* German language additions ([Gwyneth Llewelyn](https://github.com/GwynethLlewelyn))
* C/C++ support ... also requested by Gwyneth ;^)


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
