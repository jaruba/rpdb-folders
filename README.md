# RPDB Folders

Monitors Media Folders and Adds Images with Ratings (poster.jpg / background.jpg) from the [RPDB API](https://ratingposterdb.com/).

**Now also supports movie files that do not have their own subfolders!** 

This is a cross-platform solution to adding Images with Ratings for Plex / Emby / Jellyfin / Kodi / other media centers.

See screenshots of [Rating Posters in Various Apps](https://ratingposterdb.com/#see-it-in-action) and [Examples of Various Supported Rating Posters](https://ratingposterdb.com/examples/).

## Downloads

- [Windows RPDB Folders](https://github.com/RatingPosterDB/rpdb-folders/releases/download/v0.1.3/win-rpdb-folders.zip)
- [OSX RPDB Folders](https://github.com/RatingPosterDB/rpdb-folders/releases/download/v0.1.3/osx-rpdb-folders.zip)
- [Linux RPDB Folders](https://github.com/RatingPosterDB/rpdb-folders/releases/download/v0.1.3/linux-rpdb-folders.zip)
- [Docker RPDB Folders](https://hub.docker.com/r/jaruba/rpdb-folders-docker)

Note: If (for any reason) the settings web page does not open by itself after running the application, then open `http://127.0.0.1:8750/` in your browser.

## Setup in Media Center

This application will work by default with most media center applications, it is although advised that for Plex (only) you ensure that you have the "Use local assets" setting enabled for your libraries. To do this, go to Account > Libraries (under "Manage") > Click the Gear Icon on the Right Side of your Movies / Series Libraries > Advanced > Use local assets.

## Folder Naming and Usage

### Media Folders

Media folders need to be folders that include other folders of either movies or series.

Example: Presuming media folder: `C:\Media\Movies`, which includes folders such as: `Avengers Endgame (2019)`, `Wonder Woman 1984 (2020)`, etc

### Movie Folder Naming

Recommended movie folder names (in order of priority):
- `Avengers Endgame (2019)` (best)
- `Avengers Endgame 2019` (accepted)
- `Avengers Endgame` (accepted, not recommended)
- anything else (accepted, might or might not match correctly)

### Series Folder Naming

Recommended movie folder names (in order of priority):
- `WandaVision (2021)` (best)
- `WandaVision 2021` (accepted)
- `WandaVision` (accepted, not recommended)
- anything else (accepted, might or might not match correctly)

Don't know where to start? Check out the [Quick Start Guide](https://github.com/RatingPosterDB/rpdb-folders/wiki/Quick-Start-Guide)!

## Notes

- This application requires a [RPDB API Key](https://ratingposterdb.com/api-key/)
- There is also a list of command line arguments that can be [seen here](https://github.com/RatingPosterDB/rpdb-folders/wiki/Command-Line-Arguments)
- It is advised to use the "refresh library metadata periodically" or any similar setting in your media center application to ensure that posters that have not been loaded in due time will be added automatically later on
- Movies and series that have less then 500 votes on IMDB will not have rating images, these items are refreshed periodically and the images will become available as soon as it passes the 500 votes threshold
- If a movie or series has been matched wrongly (if the folder names have been made correctly this is an extremely uncommon scenario), you can use the "Fix Match" button in RPDB Folders to correctly match a folder name to either an IMDB URL or ID
- On OSX you may get an error saying that drivelist.node cannot be opened because the developer cannot be verified, if this is the case than from the RPDB Folders app location go to "node_modules/drivelist/build/Release" and open "drivelist.node" from that folder with TextEdit, this will resolve the issue

## Screenshot

![rpdb-folders-screenshot](https://user-images.githubusercontent.com/1777923/120939500-09f79200-c721-11eb-8e82-3db011eb20b3.jpg)

