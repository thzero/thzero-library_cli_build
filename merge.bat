@echo off
rem merge "<label>" ["<filter>"] [extra options, e.g. --dryRun]
if "%~2"=="" (
	node --nolazy --trace-uncaught index.js --build default --type mergeOnly --label %1 %2 %3 %4 %5
) else (
	node --nolazy --trace-uncaught index.js --build default --type mergeOnly --label %1 --filter %2 %3 %4 %5
)
