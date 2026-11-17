// 引用游标绑定head与完整目标；工程变化后重新查询，不能把新旧引用页混读。
#include "core/application/session.hpp"
#include <algorithm>
namespace gg {
Json Session::read_references(const Json& params) {
    require(format_==2,"FORMAT_UPGRADE_REQUIRED");const auto& target=params.at("target");
    Transaction read(store_,Transaction::Access::read);
    const auto kind=text(target.at("kind"));
    require((kind=="entity" || kind=="subobject")?target.at("scopeDocumentId").is_string():target.at("scopeDocumentId").is_null(),"INVALID_REFERENCE");
    const auto revision=std::to_string(head()),target_hash=hash(target.dump());std::string after_document,after_path;
    if(!params.at("after").is_null()) {
        const auto cursor=parse(text(params.at("after")),2048);
        require(cursor.is_object() && cursor.size()==4 && cursor.value("revision","")==revision && cursor.value("targetHash","")==target_hash,"CURSOR_EXPIRED");
        after_document=text(cursor.at("documentId"));after_path=text(cursor.at("path"));require(uuid(after_document),"CURSOR_EXPIRED");
    }
    const auto rows=store_.query("SELECT h.document_id,r.version_id,r.field_path,r.required,r.expected_type FROM document_refs r "
        "JOIN document_heads h ON h.version_id=r.version_id WHERE r.target_kind=? AND r.target_id=? AND r.expected_type=? "
        "AND r.scope_document_id IS ? AND (h.document_id>? OR (h.document_id=? AND r.field_path>?)) "
        "ORDER BY h.document_id,r.field_path LIMIT ?",
        {target.at("kind"),target.at("id"),target.at("type"),target.at("scopeDocumentId"),after_document,after_document,after_path,params.at("limit").get<int>()+1});
    Json items=Json::array();
    for(std::size_t index=0;index<std::min(rows.size(),params.at("limit").get<std::size_t>());++index) {
        const auto& row=rows[index];items.push_back({{"sourceDocumentId",row[0]},{"versionId",row[1]},
            {"path",row[2]},{"required",row[3]==1},{"expectedType",row[4]}});
    }
    Json next=nullptr;
    if(rows.size()>items.size())next=Json{{"revision",revision},{"targetHash",target_hash},
        {"documentId",items.back().at("sourceDocumentId")},{"path",items.back().at("path")}}.dump();
    Json result={{"headRevision",revision},{"items",items},{"nextAfter",next}};read.commit();return result;
}
}
