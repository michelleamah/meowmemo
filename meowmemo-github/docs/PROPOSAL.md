# MeowMemo: Project Proposal

MeowMemo is a meow journal for cat owners. Users record their cat, and the app tells them whether it sounds like a cat and which of three situations it's most like, or that it's unsure. They then note what was really going on in their cat's journal. Try it here: [MeowMemo live demo](https://claude.ai/artifact/KxNu2FpNf4nwjg26bbRmUq).

## Why this project

Apps like [MeowTalk](https://meowtalk.app) claim to translate meows and read a cat's feelings, with no independent evidence that this works. The main research dataset, CatMeows, only links meows to three situations (waiting for food, being brushed, and being alone in a new room). MeowMemo is built for students and young professionals with cats and only claims what that data supports.

## The app

The main version is a Next.js web app with a small Python server for the sound analysis. The live demo runs the model on the user's phone and takes clips from their voice recorder, since Claude-hosted pages can't use the microphone. Journals stay on the device. One model checks whether a sound is a cat at all (against 2,000 everyday sounds from [ESC-50](https://github.com/karolpiczak/ESC-50)); a second compares it with 440 meows from 21 cats in [CatMeows](https://zenodo.org/records/4008297).

## How well it works

| Test (on cats the model never heard in training) | Result |
| --- | --- |
| Right when it names a situation (1 in 3 clips) | 70% |
| Situation score (macro-F1) | 0.45 (random guessing: 0.33) |
| Cats recognised as cats | 90% study cats, 65% others |
| Dogs / human sounds called a cat | 0% / 5% |

That beats guessing, but not by much, so the app says "possibly" or "unsure" rather than giving one answer. Testing also caught a real mistake: the first detector learned clip length, not what a cat sounds like. The data has only 21 cats from two breeds, and the app makes no claims about emotions or health.

**Next step:** a pilot with 3 to 5 cat owners to see whether their own labels improve results.
