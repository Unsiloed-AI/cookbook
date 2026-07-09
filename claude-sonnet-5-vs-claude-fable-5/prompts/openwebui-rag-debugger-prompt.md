OpenWebUI feature add prompt for the AI models.

You are working inside the `open-webui/open-webui` repository.

Important: this is an MVP feature. Prefer a clean working implementation over a huge unfinished one.

I want you to add a new feature called **RAG Debugger** or **Chunk Inspector**.

The goal is to let users inspect what Open WebUI retrieves from uploaded documents before the LLM generates an answer.

This is not another chat-with-file feature.

Chat shows the final answer.  
The RAG Debugger should show the hidden RAG layer:

- document processing status
- extracted text preview, if available
- generated chunks
- chunk metadata
- a test query box
- retrieved chunks for that query
- score, rank, source, and metadata where available

## Main requirements

Add a user-facing RAG Debugger page or panel inside the existing Knowledge/RAG area.

The user should be able to:

1. Select an existing uploaded Knowledge document or file
2. See its processing status
3. See extracted text preview, if Open WebUI stores it
4. See generated chunks
5. Enter a test query
6. Run retrieval
7. See the top retrieved chunks before any LLM answer is generated

For each retrieved chunk, show whatever real fields are available:

- rank
- score, if available
- source file name
- document id or chunk id, if available
- chunk text
- metadata
- page number, if available

Do not invent fake values. If a field is not available, omit it or show it as unavailable.

## Very important implementation rules

Before coding, inspect the existing Open WebUI codebase and find the current:

- Knowledge/document upload flow
- RAG retrieval logic
- chunk storage logic
- frontend Knowledge UI
- backend routes related to files, documents, knowledge, or RAG

Reuse the existing RAG pipeline as much as possible.

Do not create a separate fake retrieval system.

Do not hardcode sample chunks.

Do not add paid APIs or external services.

Do not rewrite the RAG system.

Keep the implementation scoped and practical.

## Backend

Add the minimal backend support needed for the debugger.

The exact route names are up to you, but the backend should support:

1. Getting debug info for a selected document/file
2. Running a test retrieval query against the selected document/file or knowledge scope

The retrieval endpoint should call the same existing retrieval logic that normal RAG/chat uses, or the closest internal abstraction available.

Return real data only.

Handle these cases cleanly:

- document still processing
- no chunks found
- retrieval fails
- selected document does not exist
- no results returned

Reuse existing auth and permission patterns. Do not create public unauthenticated debug endpoints.

## Frontend

Add a UI that feels native to Open WebUI.

Put it somewhere sensible, such as:

- inside the Knowledge area
- as a button on a document/file row
- as a tab or panel on a document detail view
- as a new Knowledge subpage

Choose the least invasive option based on the existing app structure.

The UI should include:

- document/file selector or entry point
- basic file info
- processing status
- extracted text preview, if available
- chunk list
- test query input
- Run Retrieval button
- retrieved results list

Use readable cards or rows for chunks and retrieved results.

For long text, truncate or make it expandable.

Add loading and error states.

## README

Update the relevant README or docs file with a short note explaining:

- what the RAG Debugger does
- where to find it
- how to use it
- what the retrieved chunks mean
- known limitations

Keep this short.

## Manual test case

After implementing, I should be able to create a text file like this:

```txt
Project Codename: Blue Mango

The refund policy is 17 days.
The internal launch phrase is silver rocket pineapple.
Enterprise customers get priority support.
```

Then upload it into Open WebUI Knowledge.

Then open the RAG Debugger and run these queries:

```txt
What is the refund policy?
What is the internal launch phrase?
Who gets priority support?
```

The debugger should show the chunk containing the correct text in the retrieved results.

Do not rely on the final LLM answer for validation. The point is to inspect retrieval itself.

## Final checks

Run only the most relevant lightweight checks needed to make sure the app does not obviously break.

Do not spend too much time running the entire test suite.

At minimum, inspect the available scripts and run a relevant build/typecheck/lint command if practical.

If a command fails due to existing repo setup issues, summarize the error clearly.

## Final response

When done, summarize:

1. What you changed
2. Where the RAG Debugger lives in the UI
3. What backend route or logic you added
4. How it reuses the existing RAG pipeline
5. What README/docs update you made
6. What command you ran to verify it
7. Any known limitations
8. How I can manually test it
