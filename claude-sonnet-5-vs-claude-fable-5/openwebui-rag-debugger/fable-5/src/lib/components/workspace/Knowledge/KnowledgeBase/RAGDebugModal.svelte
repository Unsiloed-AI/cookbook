<script lang="ts">
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { getFileDebugInfo, queryDoc } from '$lib/apis/retrieval';
	import { formatFileSize } from '$lib/utils';

	import Modal from '$lib/components/common/Modal.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';

	const i18n = getContext('i18n');

	export let show = false;
	export let fileId: string | null = null;
	export let fileName = '';
	export let collectionName: string | null = null;
	export let onClose = () => {};

	let loading = false;
	let loadError: string | null = null;
	let debugInfo: any = null;

	let testQuery = '';
	let topK: number | null = null;
	let querying = false;
	let queryError: string | null = null;
	let queryResults: any = null;

	let expandedChunks: Record<string, boolean> = {};
	let expandedResults: Record<number, boolean> = {};

	let loadedFileId: string | null = null;

	$: if (show && fileId && fileId !== loadedFileId) {
		loadDebugInfo(fileId);
	}

	$: if (!show) {
		loadedFileId = null;
	}

	const loadDebugInfo = async (id: string) => {
		loadedFileId = id;
		loading = true;
		loadError = null;
		debugInfo = null;
		queryResults = null;
		queryError = null;
		testQuery = '';
		expandedChunks = {};
		expandedResults = {};

		const res = await getFileDebugInfo(localStorage.token, id).catch((e) => {
			loadError = `${e}`;
			toast.error(`${e}`);
			return null;
		});

		if (res) {
			debugInfo = res;
		}
		loading = false;
	};

	const runRetrievalHandler = async () => {
		if (testQuery.trim() === '' || querying) {
			return;
		}

		querying = true;
		queryError = null;
		queryResults = null;
		expandedResults = {};

		const res = await queryDoc(
			localStorage.token,
			collectionName ?? `file-${fileId}`,
			testQuery.trim(),
			topK || null
		).catch((e) => {
			queryError = `${e}`;
			return null;
		});

		if (res) {
			// Normalize both response shapes: hybrid search returns
			// {distances, documents, metadatas}; non-hybrid also includes ids.
			queryResults = {
				documents: res.documents?.[0] ?? [],
				metadatas: res.metadatas?.[0] ?? [],
				distances: res.distances?.[0] ?? [],
				ids: res.ids?.[0] ?? []
			};
		}
		querying = false;
	};

	const formatScore = (score: unknown) => {
		return typeof score === 'number' ? score.toFixed(4) : null;
	};

	const statusBadge = (status: string) => {
		if (status === 'completed') {
			return { type: 'success', content: $i18n.t('Completed') };
		} else if (status === 'failed') {
			return { type: 'error', content: $i18n.t('Failed') };
		}
		return { type: 'warning', content: $i18n.t('Processing') };
	};
</script>

<Modal size="lg" bind:show>
	<div class="text-gray-700 dark:text-gray-100">
		<div class="flex justify-between items-center dark:text-gray-300 px-5 pt-4 pb-1">
			<div class="text-lg font-medium self-center flex items-center gap-2 truncate">
				{$i18n.t('RAG Debugger')}
				{#if fileName}
					<span class="text-sm text-gray-500 font-normal truncate">{fileName}</span>
				{/if}
			</div>
			<button
				class="self-center"
				type="button"
				aria-label={$i18n.t('Close')}
				on:click={() => {
					show = false;
					onClose();
				}}
			>
				<XMark className="size-5" />
			</button>
		</div>

		<div class="flex flex-col w-full px-5 pb-5 dark:text-gray-200 max-h-[75vh] overflow-y-auto">
			{#if loading}
				<div class="flex justify-center items-center py-10">
					<Spinner className="size-5" />
				</div>
			{:else if loadError}
				<div class="rounded-xl bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-4 py-3 my-2">
					{loadError}
				</div>
			{:else if debugInfo}
				<!-- File info & status -->
				<div class="rounded-xl bg-gray-50 dark:bg-gray-850 px-4 py-3 text-sm">
					<div class="flex items-center gap-2 flex-wrap">
						<div class="font-medium truncate">{debugInfo.file?.name}</div>
						<Badge {...statusBadge(debugInfo.file?.status)} />
					</div>

					<div class="flex gap-3 flex-wrap mt-1.5 text-xs text-gray-500">
						{#if debugInfo.file?.size}
							<div>{formatFileSize(debugInfo.file.size)}</div>
						{/if}
						{#if debugInfo.file?.content_type}
							<div>{debugInfo.file.content_type}</div>
						{/if}
						{#if debugInfo.chunks?.collection_name}
							<div class="font-mono">
								{$i18n.t('Collection')}: {debugInfo.chunks.collection_name}
							</div>
						{/if}
						{#if debugInfo.file?.hash}
							<div class="font-mono truncate max-w-40" title={debugInfo.file.hash}>
								{$i18n.t('Hash')}: {debugInfo.file.hash.slice(0, 12)}…
							</div>
						{/if}
					</div>

					{#if debugInfo.file?.status === 'failed' && debugInfo.file?.error}
						<div class="mt-2 text-xs text-red-600 dark:text-red-400">
							{debugInfo.file.error}
						</div>
					{/if}
				</div>

				{#if debugInfo.file?.status === 'pending'}
					<div
						class="rounded-xl bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 text-sm px-4 py-3 mt-2"
					>
						{$i18n.t('This file is still processing. Chunks and retrieval are not available yet.')}
					</div>
				{:else}
					<!-- Extracted text preview -->
					<Collapsible
						title={debugInfo.content?.length
							? `${$i18n.t('Extracted Text')} (${debugInfo.content.length.toLocaleString()} ${$i18n.t('characters')})`
							: $i18n.t('Extracted Text')}
						buttonClassName="w-full py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition"
						className="mt-1 border-b border-gray-100 dark:border-gray-850"
					>
						<div slot="content" class="pb-3">
							{#if debugInfo.content?.length}
								<pre
									class="text-xs whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-850 rounded-xl px-3 py-2 max-h-60 overflow-y-auto">{debugInfo
										.content.preview}</pre>
								{#if debugInfo.content.truncated}
									<div class="text-xs text-gray-500 mt-1">
										{$i18n.t('Showing first {{shown}} of {{total}} characters', {
											shown: debugInfo.content.preview.length.toLocaleString(),
											total: debugInfo.content.length.toLocaleString()
										})}
									</div>
								{/if}
							{:else}
								<div class="text-xs text-gray-500">{$i18n.t('No extracted text available.')}</div>
							{/if}
						</div>
					</Collapsible>

					<!-- Chunks -->
					<Collapsible
						open={true}
						title={`${$i18n.t('Chunks')} (${debugInfo.chunks?.count ?? 0}${debugInfo.chunks?.truncated ? '+' : ''})`}
						buttonClassName="w-full py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition"
						className="border-b border-gray-100 dark:border-gray-850"
					>
						<div slot="content" class="pb-3 flex flex-col gap-1.5">
							{#if debugInfo.chunks?.error}
								<div class="text-xs text-red-600 dark:text-red-400">
									{$i18n.t('Failed to load chunks')}: {debugInfo.chunks.error}
								</div>
							{:else if debugInfo.bypass_embedding_and_retrieval}
								<div class="text-xs text-gray-500">
									{$i18n.t(
										'Embedding and retrieval are bypassed in the admin settings, so no chunks are stored for this file.'
									)}
								</div>
							{:else if (debugInfo.chunks?.items ?? []).length === 0}
								<div class="text-xs text-gray-500">
									{$i18n.t('No chunks found for this file.')}
								</div>
							{:else}
								{#if debugInfo.chunks.truncated}
									<div class="text-xs text-gray-500">
										{$i18n.t('Showing the first {{count}} chunks.', {
											count: debugInfo.chunks.count
										})}
									</div>
								{/if}
								{#each debugInfo.chunks.items as chunk, idx (chunk.id)}
									<div class="rounded-xl bg-gray-50 dark:bg-gray-850 px-3 py-2">
										<div class="flex gap-3 flex-wrap text-xs text-gray-500 mb-1">
											<div class="font-medium text-gray-700 dark:text-gray-300">#{idx + 1}</div>
											{#if chunk.id}
												<div class="font-mono truncate max-w-40" title={chunk.id}>
													{chunk.id}
												</div>
											{/if}
											{#if typeof chunk.metadata?.start_index === 'number'}
												<div>{$i18n.t('Offset')}: {chunk.metadata.start_index}</div>
											{/if}
											{#if chunk.metadata?.page !== undefined}
												<div>{$i18n.t('Page')}: {chunk.metadata.page}</div>
											{/if}
										</div>

										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<!-- svelte-ignore a11y-click-events-have-key-events -->
										<div
											class="text-xs whitespace-pre-wrap break-words cursor-pointer {expandedChunks[
												chunk.id
											]
												? ''
												: 'line-clamp-3'}"
											on:click={() => {
												expandedChunks[chunk.id] = !expandedChunks[chunk.id];
											}}
										>
											{chunk.text}
										</div>

										{#if chunk.metadata && Object.keys(chunk.metadata).length > 0}
											<Collapsible
												title={$i18n.t('Metadata')}
												buttonClassName="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition mt-1"
											>
												<pre
													slot="content"
													class="text-xs whitespace-pre-wrap break-words bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 mt-1 max-h-40 overflow-y-auto">{JSON.stringify(
														chunk.metadata,
														null,
														2
													)}</pre>
											</Collapsible>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</Collapsible>

					<!-- Test retrieval -->
					<div class="pt-3 flex flex-col gap-2">
						<div class="text-sm font-medium">{$i18n.t('Test Retrieval')}</div>
						<div class="text-xs text-gray-500">
							{$i18n.t(
								'Runs the same retrieval pipeline used in chat and shows the top matching chunks, before any model generates an answer.'
							)}
						</div>

						<form
							class="flex gap-2"
							on:submit|preventDefault={() => {
								runRetrievalHandler();
							}}
						>
							<input
								class="w-full text-sm rounded-xl bg-gray-50 dark:bg-gray-850 px-3 py-2 outline-hidden"
								bind:value={testQuery}
								placeholder={$i18n.t('Enter a test query')}
							/>
							<input
								class="w-20 text-sm rounded-xl bg-gray-50 dark:bg-gray-850 px-3 py-2 outline-hidden"
								type="number"
								min="1"
								bind:value={topK}
								placeholder={$i18n.t('Top K')}
							/>
							<button
								class="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm shrink-0 disabled:opacity-50 flex items-center gap-2"
								type="submit"
								disabled={querying || testQuery.trim() === ''}
							>
								{#if querying}
									<Spinner className="size-3.5" />
								{/if}
								{$i18n.t('Run Retrieval')}
							</button>
						</form>

						{#if queryError}
							<div
								class="rounded-xl bg-red-500/10 text-red-700 dark:text-red-300 text-xs px-3 py-2"
							>
								{queryError}
							</div>
						{:else if queryResults}
							{#if queryResults.documents.length === 0}
								<div class="text-xs text-gray-500">{$i18n.t('No results for this query.')}</div>
							{:else}
								<div class="flex flex-col gap-1.5">
									{#each queryResults.documents as document, idx}
										{@const metadata = queryResults.metadatas?.[idx] ?? {}}
										{@const score = formatScore(queryResults.distances?.[idx])}
										{@const resultId = queryResults.ids?.[idx]}
										<div
											class="rounded-xl px-3 py-2 {metadata?.file_id === fileId
												? 'bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800'
												: 'bg-gray-50 dark:bg-gray-850 opacity-70'}"
										>
											<div class="flex gap-3 flex-wrap text-xs text-gray-500 mb-1">
												<div class="font-medium text-gray-700 dark:text-gray-300">
													{$i18n.t('Rank')}
													{idx + 1}
												</div>
												{#if score !== null}
													<div>{$i18n.t('Score')}: {score}</div>
												{/if}
												{#if metadata?.name || metadata?.source}
													<div class="truncate max-w-40">
														{metadata?.name ?? metadata?.source}
													</div>
												{/if}
												{#if resultId}
													<div class="font-mono truncate max-w-40" title={resultId}>
														{resultId}
													</div>
												{/if}
												{#if metadata?.page !== undefined}
													<div>{$i18n.t('Page')}: {metadata.page}</div>
												{/if}
											</div>

											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<!-- svelte-ignore a11y-click-events-have-key-events -->
											<div
												class="text-xs whitespace-pre-wrap break-words cursor-pointer {expandedResults[
													idx
												]
													? ''
													: 'line-clamp-4'}"
												on:click={() => {
													expandedResults[idx] = !expandedResults[idx];
												}}
											>
												{document}
											</div>

											{#if metadata && Object.keys(metadata).length > 0}
												<Collapsible
													title={$i18n.t('Metadata')}
													buttonClassName="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition mt-1"
												>
													<pre
														slot="content"
														class="text-xs whitespace-pre-wrap break-words bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 mt-1 max-h-40 overflow-y-auto">{JSON.stringify(
															metadata,
															null,
															2
														)}</pre>
												</Collapsible>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</Modal>
