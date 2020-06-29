on run {input, parameters}
	-- set node to "/usr/local/bin/node"
	-- set artpacemetapath to "/Users/cmills/Documents/Projects/Artpace_Metadata/artpace-meta-cli.js"
	set cmd to "define "
	set p to POSIX path of input
	-- set endwaitcmd to " --inspect ;echo $?"
	set endwaitcmd to " --inspect;printf \"
This window will close in 30s...
\";sleep 30;exit"
	
	
	tell application "Terminal"
		activate
		set t to do script "clear;artpace-meta " & cmd & " " & quoted form of p & " " & endwaitcmd
		-- repeat
		-- 	delay 0.1
		--	if not busy of t then exit repeat
		-- end repeat
		-- tell front window to set theText to contents of selected tab as text
		-- return theText
	end tell
end run

on isDirectory(someItem) -- someItem is a file reference
	set filePosixPath to quoted form of (POSIX path of (someItem as alias))
	set fileType to (do shell script "file -b " & filePosixPath)
	if fileType ends with "directory" then return true
	return false
end isDirectory

on getExitCode(tabText)
	-- must echo $? after command
	set pick to -1
	repeat with t in paragraphs of theText
		if (count of t) is equal to 1 then set pick to t as text
	end repeat
	if pick is not equal to -1 then return pick
end getExitCode