<script lang="ts">
	import dayjs from '$lib/dayjs';

	import { getContext } from 'svelte';
	const i18n = getContext('i18n');

	import { formatFileSize } from '$lib/utils';
	import { getFileDebugInfo, queryFileDebug } from '$lib/apis/retrieval';

	import Modal from '$lib/components/common/Modal.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';

	export let show = false;
	export let fileId: string | null = null;
	export let fileName: string | null = null;
	export let onClose: () => void = () => {};

	let loading = false;
	let loadError = null;
	let debugInfo = null;

	let query = '';
	let querying = false;
	let queryError = null;
	let queryResult = null;

	const statusBadgeType = (status: string) => {
		switch (status) {
			case 'completed':
				return 'success';
			case 'failed':
				return 'error';
			case 'processing':
				return 'warning';
			default:
				return 'muted';
		}
	};

	const loadDebugInfo = async () => {
		if (!fileId) return;

		loading = true;
		loadError = null;
		debugInfo = null;
		query = '';
		queryResult = null;
		queryError = null;

		const res = await getFileDebugInfo(localStorage.token, fileId).catch((e) => {
			loadError = e;
			return null;
		});

		debugInfo = res;
		loading = false;
	};

	const runRetrieval = async () => {
		if (!fileId || !query.trim()) return;

		querying = true;
		queryError = null;
		queryResult = null;

		const res = await queryFileDebug(localStorage.token, fileId, query.trim()).catch((e) => {
			queryError = e;
			return null;
		});

		queryResult = res;
		querying = false;
	};

	$: if (show && fileId) {
		loadDebugInfo();
	}
</script>

<Modal size="xl" bind:show>
	<div class="flex flex-col w-full max-h-[90vh]">
		<div class="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
			<div class="flex flex-col gap-0.5 min-w-0">
				<div class="text-lg font-medium line-clamp-1">
					{$i18n.t('RAG Debugger')}
				</div>
				<div class="text-xs text-gray-500 line-clamp-1">
					{fileName ?? debugInfo?.file?.filename ?? ''}
				</div>
			</div>

			<button
				class="self-start p-1 dark:text-white"
				type="button"
				on:click={() => {
					show = false;
					onClose();
				}}
			>
				<XMark className="size-4" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-4">
			{#if loading}
				<div class="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
					<Spinner className="size-4" />
					{$i18n.t('Loading...')}
				</div>
			{:else if loadError}
				<div
					class="text-sm text-red-700 dark:text-red-300 bg-red-500/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
				>
					<span>{loadError}</span>
					<button
						class="underline shrink-0"
						type="button"
						on:click={loadDebugInfo}
					>
						{$i18n.t('Retry')}
					</button>
				</div>
			{:else if debugInfo}
				<!-- Status + file info -->
				<div class="flex flex-wrap items-center gap-2 text-xs">
					<Badge type={statusBadgeType(debugInfo.status)} content={debugInfo.status} />
					{#if debugInfo.collection_scope}
						<span class="text-gray-500">
							{debugInfo.collection_scope === 'knowledge'
								? $i18n.t('Searching within this document\'s own chunks inside its Knowledge base')
								: $i18n.t('Searching within this document\'s own chunks')}
						</span>
					{/if}
					{#if debugInfo.file?.size}
						<span class="text-gray-400">{formatFileSize(debugInfo.file.size)}</span>
					{/if}
					{#if debugInfo.file?.updated_at}
						<span class="text-gray-400">
							{dayjs(debugInfo.file.updated_at * 1000).fromNow()}
						</span>
					{/if}
				</div>

				{#if debugInfo.status === 'failed' && debugInfo.error}
					<div class="text-sm text-red-700 dark:text-red-300 bg-red-500/10 rounded-xl px-3 py-2">
						{debugInfo.error}
					</div>
				{:else if debugInfo.status !== 'completed'}
					<div
						class="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 rounded-xl px-3 py-2"
					>
						{$i18n.t('This document is still being processed. Chunks and retrieval will be available once processing completes.')}
					</div>
				{/if}

				<!-- Extracted text preview -->
				<div class="border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2">
					<Collapsible
						title={$i18n.t('Extracted Text Preview')}
						open={true}
						buttonClassName="text-sm font-medium"
					>
						<div slot="content" class="pt-2 text-xs">
							{#if debugInfo.extracted_text_preview}
								<pre
									class="whitespace-pre-wrap break-words max-h-56 overflow-y-auto font-sans text-gray-700 dark:text-gray-300">{debugInfo.extracted_text_preview}</pre>
								{#if debugInfo.extracted_text_truncated}
									<div class="text-gray-400 mt-1">
										{$i18n.t('Preview truncated ({{length}} characters total)', {
											length: debugInfo.extracted_text_length
										})}
									</div>
								{/if}
							{:else}
								<div class="text-gray-400">{$i18n.t('No extracted text available.')}</div>
							{/if}
						</div>
					</Collapsible>
				</div>

				<!-- Chunks -->
				<div class="border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2">
					<Collapsible
						title={$i18n.t('Generated Chunks ({{count}})', { count: debugInfo.chunk_count ?? 0 })}
						open={debugInfo.chunk_count > 0}
						buttonClassName="text-sm font-medium"
					>
						<div slot="content" class="pt-2 flex flex-col gap-1.5">
							{#if debugInfo.chunk_count > 0}
								{#if debugInfo.chunks_truncated}
									<div class="text-xs text-gray-400">
										{$i18n.t('Showing the first {{count}} chunks.', { count: debugInfo.chunks.length })}
									</div>
								{/if}
								{#each debugInfo.chunks as chunk (chunk.chunk_id ?? chunk.index)}
									<div class="bg-gray-50 dark:bg-gray-850 rounded-xl px-2.5 py-1.5">
										<Collapsible buttonClassName="text-xs">
											<div class="flex items-center justify-between gap-2 w-full">
												<span class="font-medium">{$i18n.t('Chunk {{index}}', { index: chunk.index })}</span>
												<span class="text-gray-400 shrink-0">{chunk.text?.length ?? 0} {$i18n.t('chars')}</span>
											</div>
											<div slot="content" class="pt-2 text-xs flex flex-col gap-2">
												<pre
													class="whitespace-pre-wrap break-words font-sans text-gray-700 dark:text-gray-300">{chunk.text}</pre>
												{#if chunk.metadata && Object.keys(chunk.metadata).length > 0}
													<div class="flex flex-col gap-0.5 text-gray-500">
														{#each Object.entries(chunk.metadata) as [key, value]}
															<div class="flex gap-1.5">
																<span class="font-medium shrink-0">{key}:</span>
																<span class="break-all"
																	>{typeof value === 'object' ? JSON.stringify(value) : value}</span
																>
															</div>
														{/each}
													</div>
												{/if}
											</div>
										</Collapsible>
									</div>
								{/each}
							{:else}
								<div class="text-xs text-gray-400">
									{$i18n.t('No chunks found for this document yet.')}
								</div>
							{/if}
						</div>
					</Collapsible>
				</div>

				<!-- Test query -->
				<div class="border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 flex flex-col gap-2">
					<div class="text-sm font-medium">{$i18n.t('Test Retrieval')}</div>

					<form
						class="flex gap-2"
						on:submit|preventDefault={runRetrieval}
					>
						<input
							class="flex-1 text-sm bg-gray-50 dark:bg-gray-850 rounded-lg px-3 py-1.5 outline-hidden"
							type="text"
							bind:value={query}
							disabled={debugInfo.status !== 'completed'}
							placeholder={$i18n.t('Enter a test query…')}
						/>
						<button
							class="px-3 py-1.5 text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
							type="submit"
							disabled={debugInfo.status !== 'completed' || !query.trim() || querying}
						>
							{#if querying}
								<Spinner className="size-4" />
							{:else}
								{$i18n.t('Run Retrieval')}
							{/if}
						</button>
					</form>

					{#if debugInfo.status !== 'completed'}
						<div class="text-xs text-gray-400">
							{$i18n.t('Retrieval is unavailable until this document finishes processing.')}
						</div>
					{/if}

					{#if queryError}
						<div class="text-xs text-red-700 dark:text-red-300 bg-red-500/10 rounded-lg px-2.5 py-1.5">
							{queryError}
						</div>
					{/if}

					{#if queryResult}
						{#if queryResult.message}
							<div class="text-xs text-gray-400">{queryResult.message}</div>
						{/if}

						{#if queryResult.results?.length > 0}
							<div class="flex flex-col gap-1.5 mt-1">
								{#each queryResult.results as hit (hit.chunk_id ?? hit.rank)}
									<div class="bg-gray-50 dark:bg-gray-850 rounded-xl px-2.5 py-1.5 text-xs flex flex-col gap-1">
										<div class="flex flex-wrap items-center gap-1.5">
											<span
												class="font-medium bg-gray-200 dark:bg-gray-700 rounded-md px-1.5 py-0.5"
												>#{hit.rank}</span
											>
											{#if hit.score !== undefined && hit.score !== null}
												<span class="text-gray-500">{$i18n.t('score')}: {hit.score.toFixed(4)}</span>
											{/if}
											{#if hit.source}
												<span class="text-gray-500 line-clamp-1">{hit.source}</span>
											{/if}
											{#if hit.page !== undefined && hit.page !== null}
												<span class="text-gray-500">{$i18n.t('page')} {hit.page}</span>
											{/if}
										</div>
										<pre
											class="whitespace-pre-wrap break-words font-sans text-gray-700 dark:text-gray-300">{hit.text}</pre>
										{#if hit.chunk_id || hit.file_id}
											<div class="text-gray-400 flex gap-2 flex-wrap">
												{#if hit.chunk_id}<span>{$i18n.t('chunk_id')}: {hit.chunk_id}</span>{/if}
												{#if hit.file_id}<span>{$i18n.t('file_id')}: {hit.file_id}</span>{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</Modal>
