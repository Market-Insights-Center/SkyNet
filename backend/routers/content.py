from fastapi import APIRouter, HTTPException
from backend.schemas import (
    ArticleCreateRequest, ArticleDeleteRequest, VoteRequest, ShareRequest, EmailShareRequest,
    IdeaCreateRequest, IdeaDeleteRequest, CommentCreateRequest
)
from backend.config import get_mod_list
from backend.database import (
    read_articles_from_csv, save_articles_to_csv, read_ideas_from_csv, 
    save_ideas_to_csv, read_comments_from_csv, save_comments_to_csv,
    delete_article, delete_idea, delete_comment
)

router = APIRouter()

# --- ARTICLES ---

@router.get("/api/articles")
def get_articles(limit: int = 100):
    articles = read_articles_from_csv()
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    return articles[:limit]

@router.get("/api/articles/{article_id}")
def get_article_by_id(article_id: int):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    all_comments = read_comments_from_csv()
    article_comments = [c for c in all_comments if str(c.get('article_id')) == str(article_id)]
    article_comments.sort(key=lambda x: x.get('date', ''), reverse=True)
    article['comments'] = article_comments
    return article

@router.post("/api/articles")
def create_article(req: ArticleCreateRequest):
    articles = read_articles_from_csv()
    new_id = 1
    if articles:
        new_id = max([int(a['id']) for a in articles]) + 1
    new_article = {
        "id": new_id,
        "title": req.title,
        "subheading": req.subtitle if req.subtitle else "",
        "content": req.content,
        "author": req.author,
        "date": req.date,
        "category": "Insight", 
        "hashtags": req.hashtags,
        "cover_image": req.cover_image if req.cover_image else "",
        "likes": 0,
        "dislikes": 0,
        "shares": 0,
        "liked_by": [],
        "disliked_by": []
    }
    articles.insert(0, new_article)
    save_articles_to_csv(articles)
    return new_article

@router.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, req: VoteRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    liked_by = article.get('liked_by', [])
    disliked_by = article.get('disliked_by', [])
    if req.vote_type == 'up':
        if req.user_id in liked_by: liked_by.remove(req.user_id)
        else:
            liked_by.append(req.user_id)
            if req.user_id in disliked_by: disliked_by.remove(req.user_id)
    elif req.vote_type == 'down':
        if req.user_id in disliked_by: disliked_by.remove(req.user_id)
        else:
            disliked_by.append(req.user_id)
            if req.user_id in liked_by: liked_by.remove(req.user_id)
    article['liked_by'] = liked_by
    article['disliked_by'] = disliked_by
    article['likes'] = len(liked_by)
    article['dislikes'] = len(disliked_by)
    save_articles_to_csv(articles)
    return {"status": "success", "likes": article['likes'], "dislikes": article['dislikes']}

@router.post("/api/articles/{article_id}/share")
def share_article(article_id: int, req: ShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    current_shares = article.get('shares', 0)
    article['shares'] = current_shares + 1
    save_articles_to_csv(articles)
    return {"status": "success", "shares": article['shares']}

@router.post("/api/articles/{article_id}/share/email")
def share_article_email(article_id: int, req: EmailShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    current_shares = article.get('shares', 0)
    article['shares'] = current_shares + 1
    save_articles_to_csv(articles)
    return {"status": "success", "message": f"Email sent to {req.email}"}

@router.post("/api/admin/articles/delete")
def api_delete_article(req: ArticleDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_article(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Article not found")

# --- IDEAS ---

@router.get("/api/ideas")
def get_ideas(limit: int = 100):
    ideas = read_ideas_from_csv()
    all_comments = read_comments_from_csv()
    all_comments.sort(key=lambda x: x.get('date', ''), reverse=True)
    for idea in ideas:
        idea_id = str(idea.get('id'))
        idea['comments'] = [c for c in all_comments if str(c.get('idea_id')) == idea_id]
    ideas.sort(key=lambda x: x.get('date', ''), reverse=True)
    return ideas[:limit]

@router.post("/api/ideas")
def create_idea(req: IdeaCreateRequest):
    ideas = read_ideas_from_csv()
    new_id = 1
    if ideas: new_id = max([int(i['id']) for i in ideas]) + 1
    new_idea = {
        "id": new_id,
        "ticker": req.ticker,
        "title": req.title,
        "description": req.description,
        "author": req.author,
        "date": req.date,
        "hashtags": req.hashtags,
        "cover_image": req.cover_image if req.cover_image else "",
        "likes": 0,
        "dislikes": 0,
        "liked_by": [],
        "disliked_by": []
    }
    ideas.insert(0, new_idea)
    save_ideas_to_csv(ideas)
    return new_idea

@router.post("/api/ideas/{idea_id}/vote")
def vote_idea(idea_id: int, req: VoteRequest):
    ideas = read_ideas_from_csv()
    idea = next((i for i in ideas if int(i['id']) == idea_id), None)
    if not idea: raise HTTPException(status_code=404, detail="Idea not found")
    liked_by = idea.get('liked_by', [])
    disliked_by = idea.get('disliked_by', [])

    if req.vote_type == 'up':
        if req.user_id in liked_by: liked_by.remove(req.user_id)
        else:
            liked_by.append(req.user_id)
            if req.user_id in disliked_by: disliked_by.remove(req.user_id)
    elif req.vote_type == 'down':
        if req.user_id in disliked_by: disliked_by.remove(req.user_id)
        else:
            disliked_by.append(req.user_id)
            if req.user_id in liked_by: liked_by.remove(req.user_id)
    idea['liked_by'] = liked_by
    idea['disliked_by'] = disliked_by
    idea['likes'] = len(liked_by)
    idea['dislikes'] = len(disliked_by)
    save_ideas_to_csv(ideas)
    return {"status": "success", "likes": idea['likes'], "dislikes": idea['dislikes']}

@router.post("/api/admin/ideas/delete")
def api_delete_idea(req: IdeaDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_idea(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Idea not found")

# --- COMMENTS ---

@router.post("/api/comments")
def create_comment(req: CommentCreateRequest):
    comments = read_comments_from_csv()
    new_id = 1
    if comments: new_id = max([int(c['id']) for c in comments]) + 1
    new_comment = {
        "id": new_id,
        "idea_id": req.idea_id,
        "article_id": req.article_id,
        "user_id": req.user_id,
        "user": req.user,
        "email": req.email,
        "text": req.text,
        "date": req.date,
        "isAdmin": False
    }
    mods = get_mod_list()
    if req.email.lower() in mods: new_comment['isAdmin'] = True
    comments.insert(0, new_comment)
    save_comments_to_csv(comments)
    return new_comment

@router.delete("/api/comments/{comment_id}")
def api_delete_comment(comment_id: int, requester_email: str):
    mods = get_mod_list()
    if requester_email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized to delete comments")
    if delete_comment(comment_id): return {"status": "success"}
    raise HTTPException(status_code=404, detail="Comment not found")
