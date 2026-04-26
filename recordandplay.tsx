import React, { useEffect, useRef } from "react";
import {
	ActivityIndicator,
	Image,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { createSound } from "react-native-nitro-sound";
import { record_end, record_start } from "./assets/audio";
import { useAudio } from "./src/audio/AudioContext";

const RECORD_START_URI = Image.resolveAssetSource(record_start)?.uri;
const RECORD_END_URI = Image.resolveAssetSource(record_end)?.uri;

export function RecordAndPlay() {
	const { recorder, player } = useAudio();
	const rec = recorder.state;
	const ply = player.state;

	const sfxRef = useRef<ReturnType<typeof createSound> | null>(null);

	useEffect(() => {
		sfxRef.current = createSound();
		return () => {
			sfxRef.current?.dispose();
			sfxRef.current = null;
		};
	}, []);

	const playSfx = async (uri: string | undefined) => {
		if (!uri) {
			return;
		}
		const sfx = sfxRef.current;
		if (!sfx) {
			return;
		}
		try {
			await sfx.stopPlayer();
		} catch {
			/* noop */
		}
		try {
			await sfx.startPlayer(uri);
		} catch {
			/* noop */
		}
	};

	const onRecordPress = () => {
		if (rec.isRecording) {
			recorder
				.stop()
				.then(() => playSfx(RECORD_END_URI))
				.catch(() => {});
		} else {
			recorder
				.start()
				.then(() => playSfx(RECORD_START_URI))
				.catch(() => {});
		}
	};

	const onPlayPress = () => {
		const path = rec.lastRecordingPath;
		if (!path) {
			return;
		}
		if (ply.isPlaying && !ply.isPaused) {
			player.stop().catch(() => {});
			return;
		}
		if (ply.isPaused) {
			player.resume().catch(() => {});
			return;
		}
		player.start(path).catch(() => {});
	};

	const recordDisabled = rec.isBusy && !rec.isRecording;
	const playDisabled =
		!rec.lastRecordingPath ||
		rec.isRecording ||
		ply.isBusy ||
		(rec.isBusy && !rec.isRecording);

	return (
		<View style={styles.screen}>
			<View style={styles.centerBlock}>
				<Text style={styles.heading}>Voice memo</Text>
				<Text style={styles.subtitle}>
					Tap Record to capture audio, then Play to hear it back.
				</Text>

				{(rec.error || ply.error) && (
					<Text style={styles.error}>{rec.error ?? ply.error}</Text>
				)}

				<View style={styles.buttonRow}>
					<Pressable
						style={({ pressed }) => [
							styles.recordCircle,
							rec.isRecording && styles.recordCircleActive,
							pressed && styles.pressedOpacity,
						]}
						onPress={onRecordPress}
						disabled={recordDisabled}>
						{recordDisabled ? (
							<ActivityIndicator color='#fff' />
						) : (
							<Text style={styles.recordLabel}>Record</Text>
						)}
					</Pressable>

					<Pressable
						style={({ pressed }) => [
							styles.playPill,
							playDisabled && styles.playPillDisabled,
							pressed && !playDisabled && styles.pressedOpacity,
						]}
						onPress={onPlayPress}
						disabled={playDisabled}>
						{ply.isBusy ? (
							<ActivityIndicator color='#fff' />
						) : (
							<Text style={styles.playLabel}>Play</Text>
						)}
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const coral = "#F25555";
const coralRecording = "#D94444";
const playBlue = "#0A84FF";
const playBlueDisabled = "#9EBCE0";

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#F2F2F4",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
	},
	centerBlock: {
		alignItems: "center",
		maxWidth: 320,
	},
	heading: {
		fontSize: 22,
		fontWeight: "700",
		color: "#000",
		textAlign: "center",
		marginBottom: 10,
	},
	subtitle: {
		fontSize: 15,
		fontWeight: "400",
		color: "#555",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 36,
	},
	error: {
		color: "#c00",
		fontSize: 13,
		textAlign: "center",
		marginBottom: 16,
	},
	buttonRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 20,
	},
	recordCircle: {
		width: 108,
		height: 108,
		borderRadius: 54,
		backgroundColor: coral,
		alignItems: "center",
		justifyContent: "center",
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 4 },
				shadowOpacity: 0.18,
				shadowRadius: 8,
			},
			android: {
				elevation: 6,
			},
		}),
	},
	recordCircleActive: {
		backgroundColor: coralRecording,
	},
	recordLabel: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 16,
	},
	playPill: {
		minWidth: 108,
		height: 56,
		paddingHorizontal: 28,
		borderRadius: 18,
		backgroundColor: playBlue,
		alignItems: "center",
		justifyContent: "center",
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 4 },
				shadowOpacity: 0.18,
				shadowRadius: 8,
			},
			android: {
				elevation: 6,
			},
		}),
	},
	playPillDisabled: {
		backgroundColor: playBlueDisabled,
	},
	playLabel: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 16,
	},
	pressedOpacity: {
		opacity: 0.88,
	},
});
