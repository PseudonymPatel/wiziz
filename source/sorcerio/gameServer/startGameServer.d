module sorcerio.gameServer.startGameServer;

import vibe.vibe : WebSocket;
import std.concurrency;
import core.time;
import core.thread;

import sorcerio.webServer.messageQueue;
import sorcerio.webServer.playerConfig;
import sorcerio.gameServer.serverManager;

///
void startGameServer(shared MessageQueue queue) {
	scope (exit) {
		import core.stdc.stdlib;
		_Exit(EXIT_FAILURE);
	}

	ServerManager master = new ServerManager(queue);

	while (true) {
		void receiveMessages() {
			receiveTimeout(Duration.zero,
				(shared PlayerConfig cfg) {
					master.addPlayerToServer(cast(PlayerConfig) cfg);
				},
				(uint disconnectSocketId) {
					master.removePlayerBySocketId(disconnectSocketId);
				}
			);
		}

		version (unittest) {//for CI - don't fail if owner thread terminates
			try {
				receiveMessages();
			} catch (OwnerTerminated e) {
				import core.stdc.stdlib;
				_Exit(EXIT_SUCCESS);
			}
		} else {//normal behavior:
			receiveMessages();
		}

		try {
			master.tick();
		} catch (Throwable e) {
			import std.stdio;
			stderr.writeln(e);
			throw e;
		}

		Thread.sleep(dur!"msecs"(5));
	}
}

unittest {///make sure that all spells are implemented
	import std.traits;
	import core.exception;
	import std.stdio;
	import std.conv;

	import sorcerio.gameServer.spell;

	bool error = false;
	foreach (name; [EnumMembers!SpellName]) {
		//make sure that all spells are registered:
		try {
			SpellFactory.getCoolDownTime(name);
		} catch (RangeError e) {
			writeln("Spell not registered with SpellFactory: ", name);
			//error = true;//TODO: uncomment this once all spells are implemented
		}

		//make sure that all spells have images for their inventory slot:
		bool fileExists(string path) {
			import std.file;
			if (path.exists && path.isFile) {
				return true;
			}
			return false;
		}

		string inventoryItemPath = "public/media/images/" ~ name.to!string ~ "Spell.png";
		if (!fileExists(inventoryItemPath)) {
			writeln("'", name.to!string, "' spell does not have an inventory image at ", inventoryItemPath);
			error = true;
		}

		//make sure that all spells have sounds:
		string baseSoundPath = "public/media/sounds/" ~ name.to!string ~ "Spell.";
		if (!fileExists(baseSoundPath~"ogg")) {
			writeln("'", name.to!string, "' spell does not have a sound at ", baseSoundPath~"ogg");
			error = true;
		}

		if (!fileExists(baseSoundPath~"mp3")) {
			writeln("'", name.to!string, "' spell does not have a sound at ", baseSoundPath~"mp3");
			error = true;
		}

		//warn if a spell is not unlockable:
		import std.algorithm.searching : canFind;
		if (!allUnlockableSpells.canFind(name)) {
			writeln("NOTE: '", name.to!string, "' spell is not unlockable (not in `spellUnlocks`)");
		}
	}

	assert(!error, "Not all spells defined in SpellName are fully implemented (see above messages).");
}
