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
* Rust
* TypeScript/TSX

You can read more about documentation comments here: [JSDoc](https://jsdoc.app/) and [phpDocumentor](https://phpdoc.org).


### Note

This started as a port of [DocBlockr for Atom](https://github.com/nikhilkalige/docblockr) by Nikhil Kalige, which is a port of [DocBlockr for Sublime Text](https://github.com/spadgos/sublime-jsdocs) by Nick Fisher. By now large parts of the original code were refactored and I basically kept the RegExp only. More or less.

I may eventually try to port other languages from the original package if there’s a high demand.


### Special Thanks

Portuguese translation by [Gwyneth Llewelyn](https://github.com/GwynethLlewelyn)
