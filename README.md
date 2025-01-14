# Supalosa's Chrono Divide Bot

[中文版文档](README-CN.md)

[Chrono Divide](https://chronodivide.com/) is a ground-up rebuild of Red Alert 2 in the browser. It is feature-complete and allows for online skirmish play against other players.
It also provides [an API to build bots](https://discord.com/channels/771701199812558848/842700851520339988), as there is no built-in AI yet.

This repository is one such implementation of a bot. The original template for the bot is available at [game-api-playground](https://github.com/chronodivide/game-api-playground/blob/master/README.md).

## Development State and Future plans

The developer of Chrono Divide has expressed interest in integrating this bot into the game directly. As a consequence, I am aiming to implement missing features to create a satisfactory AI opponent for humans.
Directionally, this means I am not looking to make this AI a perfect opponent with perfect compositions or micro, and instead hope that it can be a fun challenge for newer players.

See `TODO.md` for a granular list of structural changes and feature improvements that are planned for the bot.

Feel free to contribute to the repository, or even fork the repo and build your own version.

## Install instructions

Node 14 is required by the Chrono Divide API. Higher versions are not supported yet.

```sh
npm install
npm run build
npx cross-env MIX_DIR="C:\path_to_ra2_install_dir" npm start
```

This will create a replay (`.rpl`) file that can be [imported into the live game](https://game.chronodivide.com/).

You can modify `exampleBot.ts` to configure the match. You will most likely want to look at the line with `const mapName = "..."` to change the map, or the `const offlineSettings1v1` to change the bot countries.

## Playing against the bot

Currently, playing against this bot **is only possible for developers**, because it requires you to run this repository from source. Follow these steps to set up online play.

### Initial set up steps (one time only)

1. Create a Chronodivide account for your bot using the official client at [https://game.chronodivide.com].
2. If you don't already have one, create a Chronodivide account for yourself using the same link,
3. Copy `.env.template` to `.env`. The `.env` file is not checked into the repo.
4. Set the value of `ONLINE_BOT_NAME` to the username of the bot from step 1.
5. Set the value of `ONLINE_BOT_PASSWORD` to the password from step 1.
6. Set the value of `PLAYER_NAME` to the human's account name.
7. (Optional) Change `SERVER_URL` if you want to connect to another server. The Chronodivide accounts from step 1 and 2 need to be present on that server.

### Running the bot and connecting to the game

Start the bot with `ONLINE_MATCH=1`. For example:

```sh
ONLINE_MATCH=1 npx cross-env MIX_DIR="${GAMEPATH}" npm --node-options="${NODE_OPTIONS} --inspect" start
```

The bot will connect to the server and should return output like this:

```
You may use the following link(s) to join, after the game is created:

https://game.chronodivide.com/#/game/12345/supalosa


Press ENTER to create the game now...
```

Navigate to the link, **log in using the human credentials first**, then hit ENTER in the terminal so the bot can create the game.
Do not hit ENTER too early, as there is a very narrow window for the human connect to the match.

## Debugging

To generate a replay with debugging enabled:

```sh
npx cross-env MIX_DIR="C:\path_to_ra2_install_dir" npm --node-options="${NODE_OPTIONS} --inspect" start
```

To log all actions generated by the bots:

```sh
DEBUG_LOGGING="action" npx cross-env MIX_DIR="${GAMEPATH}" npm --node-options="${NODE_OPTIONS} --inspect" start
```

We also take advantage of the in-game bot debug functionality provided by CD. These are basically bot-only actions that are saved in the replay, but you must enable the visualisations in the CD client before watching the replay, by typing the following into the dev console:.

```
r.debug_text = true;
```

This will debug the bot which has been configured with `setDebugMode(true)`, this is done in `exampleBot.ts`.

## Publishing

Have the npmjs token in ~/.npmrc or somewhere appropriate.

```
npm publish
```

## Contributors

- use-strict: Making Chrono Divide
- Libi: Improvements to base structure placement performance
- Dogemoon: CN Documentation
