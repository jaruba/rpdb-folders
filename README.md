# RPDB Folders

Monitors Media Folders and Adds Images with Ratings (poster.jpg / background.jpg) from the [RPDB API](https://ratingposterdb.com/).

This is a cross-platform solution to adding Images with Ratings for Plex / Emby / Kodi / other media centers.

See screenshots of [Rating Posters in Various Apps](https://ratingposterdb.com/#see-it-in-action) and [Examples of Various Supported Rating Posters](https://ratingposterdb.com/examples/).

## Downloads

- [Windows RPDB Folders](https://github.com/jaruba/rpdb-folders/releases/download/v0.0.2/win-rpdb-folders.zip)
- [OSX RPDB Folders](https://github.com/jaruba/rpdb-folders/releases/download/v0.0.2/osx-rpdb-folders.zip)
- [Linux RPDB Folders](https://github.com/jaruba/rpdb-folders/releases/download/v0.0.2/linux-rpdb-folders.zip)

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

## Notes

- This application requires a [RPDB API Key](https://ratingposterdb.com/api-key/)
- it is advised to use the "refresh library metadata periodically" or any similar setting in your media center application to ensure that posters that have not been loaded in due time will be added automatically later on
- movies and series that have less then 500 votes on IMDB will not have rating images, these items are refreshed periodically and the images will become available as soon as it passes the 500 votes threshold

## Screenshot

![screenshot-rpdb-folders](https://user-images.githubusercontent.com/1777923/108631426-9c29a200-7472-11eb-8b0d-bce13eb5c96c.jpg)
