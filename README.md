# DocBlockr for Nova

Nova extension to make writing documentation easier.

Work in progress!

DocBlockr helps you add documentation comments to your source code. Just type `/**` in the editor and select the completion suggestion.

![screencast](https://raw.githubusercontent.com/maxgrafik/DocBlockr.novaextension/main/Images/readme/screencast.gif)

If the line directly afterwards contains a function definition or variable declaration, some documentation is automatically added with placeholders you can tab through. DocBlockr will try to make an intelligent guess about the return value of a function.

To (re-)format a comment block select it (or just place the cursor inside) and select **Editor > DocBlockr > Format DocBlock**.

DocBlockr currently supports JavaScript, TypeScript and PHP. You can read more about documentation comments here: [JSDoc](https://jsdoc.app/) and [phpDocumentor](https://phpdoc.org).

Experimentally, C/C++ and other C-inspired languages are also supported, but inactive by default.

### Note

This started as a port of [DocBlockr for Atom](https://github.com/nikhilkalige/docblockr) by Nikhil Kalige, which is a port of [DocBlockr for Sublime Text](https://github.com/spadgos/sublime-jsdocs) by Nick Fisher. By now large parts of the original code were refactored and I basically kept the RegExp only. More or less.