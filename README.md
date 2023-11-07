# DocBlockr for Nova

Nova extension to make writing documentation easier.

DocBlockr helps you add documentation comments to your source code. Just type `/**` in the editor and select the completion suggestion.

![screencast](https://raw.githubusercontent.com/maxgrafik/DocBlockr.novaextension/main/Images/readme/screencast.gif)

If the line directly afterwards contains a function definition or variable declaration, some documentation is automatically added with placeholders you can tab through. DocBlockr will try to make an intelligent guess about the return value of a function.

To (re-)format a comment block select it (or just place the cursor inside) and select **Editor > DocBlockr > Format DocBlock**.

DocBlockr for Nova currently supports
* C/C++, LSL
* Java
* JavaScript/JSX
* ObjC/ObjC++
* PHP
* Ruby *(experimental)*
* Rust
* Swift *(experimental)*
* TypeScript/TSX

You can read more about documentation comments here: [JSDoc](https://jsdoc.app/) and [phpDocumentor](https://phpdoc.org).


## Header blocks

DocBlockr may additionally provide a header comment, if the cursor is at the top of your source file. Header comments start with the file and workspace name. You may add more tags globally or per workspace in the extension settings, e.g.:

* pre-filled tags: e.g. **@copyright *year* *name***
* tags only: e.g. **@author** (in which case DocBlockr adds the missing placeholders according to the doc comment specification)
* free-form text

Each of these also accept tabbable placeholders and [Nova variables](https://docs.nova.app/extensions/snippets/), e.g. `@copyright ${year} $AUTHOR_NAME`


### Note

This started as a port of [DocBlockr for Atom](https://github.com/nikhilkalige/docblockr) by Nikhil Kalige, which is a port of [DocBlockr for Sublime Text](https://github.com/spadgos/sublime-jsdocs) by Nick Fisher. By now large parts of the original code were refactored and I basically kept the RegExp only. More or less.


### Special Thanks

Portuguese translation by [Gwyneth Llewelyn](https://github.com/GwynethLlewelyn)
