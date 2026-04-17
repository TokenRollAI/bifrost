/**
 * Complexity Router Configuration Page
 * Edits tier boundaries and editable keyword lists that feed the complexity analyzer.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scrollArea";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tagInput";
import { getErrorMessage } from "@/lib/store";
import {
	useGetComplexityAnalyzerConfigQuery,
	useResetComplexityAnalyzerConfigMutation,
	useUpdateComplexityAnalyzerConfigMutation,
} from "@/lib/store/apis/governanceApi";
import {
	AnalyzerConfig,
	DEFAULT_TIER_BOUNDARIES,
	KEYWORD_LIST_DEFINITIONS,
	KeywordListKey,
	TierBoundaries,
} from "@/lib/types/complexityRouter";
import { cn } from "@/lib/utils";
import { LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

type TierBoundaryKey = keyof TierBoundaries;

interface BoundaryFieldConfig {
	key: TierBoundaryKey;
	label: string;
	description: string;
}

const BOUNDARY_FIELDS: BoundaryFieldConfig[] = [
	{
		key: "simple_medium",
		label: "Simple → Medium",
		description: "Scores at or below this are classified as SIMPLE.",
	},
	{
		key: "medium_complex",
		label: "Medium → Complex",
		description: "Scores at or below this (and above simple_medium) are classified as MEDIUM.",
	},
	{
		key: "complex_reasoning",
		label: "Complex → Reasoning",
		description: "Scores above this are classified as REASONING. Everything in between is COMPLEX.",
	},
];

const DEFAULT_FORM_VALUES: AnalyzerConfig = {
	tier_boundaries: { ...DEFAULT_TIER_BOUNDARIES },
	keywords: {
		code_keywords: [],
		reasoning_keywords: [],
		technical_keywords: [],
		simple_keywords: [],
	},
};

export default function ComplexityRouterPage() {
	const { data, isLoading, isFetching, error, refetch } = useGetComplexityAnalyzerConfigQuery();
	const [updateConfig, { isLoading: isSaving }] = useUpdateComplexityAnalyzerConfigMutation();
	const [resetConfig, { isLoading: isResetting }] = useResetComplexityAnalyzerConfigMutation();

	const [submitError, setSubmitError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		control,
		getValues,
		formState: { errors, isDirty, isSubmitted },
	} = useForm<AnalyzerConfig>({
		defaultValues: DEFAULT_FORM_VALUES,
		mode: "onSubmit",
		reValidateMode: "onChange",
	});

	useEffect(() => {
		if (data) {
			reset(data);
			setSubmitError(null);
		}
	}, [data, reset]);

	const handleDiscard = () => {
		if (data) reset(data);
		setSubmitError(null);
	};

	const handleRestoreDefaults = () => {
		setSubmitError(null);
		resetConfig()
			.unwrap()
			.then((defaults) => {
				reset(defaults);
				toast.success("Complexity analyzer config reset to defaults", { position: "top-right" });
			})
			.catch((err) => {
				setSubmitError(getErrorMessage(err));
			});
	};

	const onValid = (values: AnalyzerConfig) => {
		setSubmitError(null);
		updateConfig(values)
			.unwrap()
			.then((res) => {
				reset(res);
				toast.success("Complexity analyzer config updated", { position: "top-right" });
			})
			.catch((err) => {
				setSubmitError(getErrorMessage(err));
			});
	};

	if (isLoading && !data) {
		return (
			<div className="mx-auto w-full max-w-7xl">
				<p className="text-muted-foreground text-sm">Loading complexity analyzer config…</p>
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className="mx-auto w-full max-w-7xl space-y-4">
				<p className="text-destructive text-sm">Failed to load complexity analyzer config: {getErrorMessage(error)}</p>
				<Button type="button" variant="outline" onClick={() => refetch()}>
					Retry
				</Button>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	const boundaryErrors = errors.tier_boundaries;
	const keywordErrors = errors.keywords;
	const hasErrors = Boolean(boundaryErrors || keywordErrors);

	return (
		<ScrollArea className="no-padding-parent no-border-parent h-[calc(100vh_-_16px)] w-full px-14 pt-4">
			<form className="mx-auto w-full max-w-7xl space-y-6" onSubmit={handleSubmit(onValid)} noValidate>
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold">Complexity Router</h1>
					<p className="text-muted-foreground text-sm">
						Tune how incoming requests are classified into SIMPLE, MEDIUM, COMPLEX, and REASONING tiers. These settings feed the
						<code className="bg-muted mx-1 rounded px-1 py-0.5 text-xs">complexity_tier</code>
						field that routing rules can target.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Tier boundaries</CardTitle>
						<CardDescription>
							Thresholds that split the 0-to-1 complexity score into tiers. Values must be strictly ordered: 0 &lt; simple_medium &lt;
							medium_complex &lt; complex_reasoning &lt; 1.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 md:grid-cols-3">
						{BOUNDARY_FIELDS.map(({ key, label, description }) => {
							const fieldError = boundaryErrors?.[key];
							const inputId = `boundary-${key}`;
							const errorId = `${inputId}-error`;
							return (
								<div key={key} className="space-y-2">
									<Label htmlFor={inputId}>{label}</Label>
									<Input
										id={inputId}
										type="number"
										min={0}
										max={1}
										step={0.01}
										aria-invalid={fieldError ? true : undefined}
										aria-describedby={fieldError ? errorId : undefined}
										className={cn(fieldError && "border-destructive focus-visible:ring-destructive")}
										{...register(`tier_boundaries.${key}`, {
											required: "Enter a number between 0 and 1",
											valueAsNumber: true,
											validate: (value) => {
												if (!Number.isFinite(value)) return "Enter a number between 0 and 1";
												if (value <= 0) return "Must be greater than 0";
												if (value >= 1) return "Must be less than 1";
												const { simple_medium, medium_complex } = getValues("tier_boundaries");
												if (key === "medium_complex" && Number.isFinite(simple_medium) && value <= simple_medium) {
													return "Must be greater than Simple → Medium";
												}
												if (key === "complex_reasoning" && Number.isFinite(medium_complex) && value <= medium_complex) {
													return "Must be greater than Medium → Complex";
												}
												return true;
											},
											deps:
												key === "simple_medium"
													? ["tier_boundaries.medium_complex"]
													: key === "medium_complex"
														? ["tier_boundaries.complex_reasoning"]
														: undefined,
										})}
									/>
									{fieldError ? (
										<p id={errorId} className="text-destructive text-xs">
											{fieldError.message}
										</p>
									) : (
										<p className="text-muted-foreground text-xs">{description}</p>
									)}
								</div>
							);
						})}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Keyword lists</CardTitle>
						<CardDescription>
							Keywords are lowercased, trimmed, and deduplicated on save. Every list must contain at least one entry — the backend rejects
							empty lists.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{KEYWORD_LIST_DEFINITIONS.map(({ key, label, description }, i) => {
							const fieldError = keywordErrors?.[key as KeywordListKey];
							const errorId = `keywords-${key}-error`;
							return (
								<div key={key}>
									{i > 0 && <Separator className="mb-6" />}
									<Controller
										control={control}
										name={`keywords.${key}` as const}
										rules={{ validate: (value) => (value.length > 0 ? true : `${label} cannot be empty`) }}
										render={({ field }) => (
											<div className="space-y-2">
												<div className="flex items-center justify-between gap-4">
													<Label>{label}</Label>
													<span className="text-muted-foreground text-xs">{field.value.length} entries</span>
												</div>
												<p className="text-muted-foreground text-xs">{description}</p>
												<TagInput
													value={field.value}
													onValueChange={field.onChange}
													placeholder="Type a keyword and press Enter"
													aria-invalid={fieldError ? true : undefined}
													aria-describedby={fieldError ? errorId : undefined}
													className={cn(fieldError && "border-destructive")}
												/>
												{fieldError && (
													<p id={errorId} className="text-destructive text-xs">
														{fieldError.message}
													</p>
												)}
											</div>
										)}
									/>
								</div>
							);
						})}
					</CardContent>
				</Card>

				{submitError && (
					<div role="alert" className="border-destructive/40 bg-destructive/10 text-destructive rounded-sm border px-3 py-2 text-sm">
						{submitError}
					</div>
				)}

				<div className="bg-card sticky bottom-0 flex flex-wrap items-center justify-end gap-3 py-4">
					<Button type="button" variant="ghost" onClick={handleRestoreDefaults} disabled={isSaving || isResetting}>
						{isResetting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
						Restore defaults
					</Button>
					<Button type="button" variant="outline" onClick={handleDiscard} disabled={!isDirty || isSaving || isResetting || isFetching}>
						Discard changes
					</Button>
					<Button type="submit" disabled={!isDirty || isSaving || isResetting || (isSubmitted && hasErrors)}>
						<Save className="h-4 w-4" />
						{isSaving ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</form>
		</ScrollArea>
	);
}
