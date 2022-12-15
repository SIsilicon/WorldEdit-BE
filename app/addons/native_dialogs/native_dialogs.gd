const Message = preload("./bin/native_dialog_message.gdns")
const Notify = preload("./bin/native_dialog_notify.gdns")
const OpenFile = preload("./bin/native_dialog_open_file.gdns")
const SaveFile = preload("./bin/native_dialog_save_file.gdns")
const SelectFolder = preload("./bin/native_dialog_select_folder.gdns")

enum MessageChoices { OK, OK_CANCEL, YES_NO, YES_NO_CANCEL }
enum MessageIcons { INFO, WARNING, ERROR, QUESTION }
enum MessageResults { OK, CANCEL, YES, NO }

enum NotifyIcons { INFO, WARNING, ERROR }
